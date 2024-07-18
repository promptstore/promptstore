import axios from 'axios';
import fs from 'fs';
import gm from 'gm';
import path from 'path';
import uuid from 'uuid';
// import { createCanvas } from 'canvas';

import { downloadImage } from '../utils';

const transparencyHexCodes = {
  '1.0': 'FF',
  '0.95': 'F2',
  '0.9': 'E6',
  '0.85': 'D9',
  '0.8': 'CC',
  '0.75': 'BF',
  '0.7': 'B3',
  '0.65': 'A6',
  '0.6': '99',
  '0.55': '8C',
  '0.5': '80',
  '0.45': '73',
  '0.4': '66',
  '0.35': '59',
  '0.3': '4D',
  '0.25': '40',
  '0.2': '33',
  '0.15': '26',
  '0.1': '1A',
  '0.05': '0D',
};

export default ({ app, auth, constants, logger, mc, services }) => {

  const { imagesService } = services;

  app.get('/api/workspaces/:workspaceId/images', auth, async (req, res) => {
    const { workspaceId } = req.params;
    const { limit, start } = req.query;
    const images = await imagesService.getImages(workspaceId, limit, start);
    res.json(images);
  });

  app.get('/api/users/:userId/images', auth, async (req, res) => {
    const { userId } = req.params;
    const { limit, start } = req.query;
    const images = await imagesService.getUserImages(userId, limit, start);
    res.json(images);
  });

  app.get('/api/images/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const image = await imagesService.getImage(id);
    res.json(image);
  });

  app.post('/api/images/:id/crop', auth, async (req, res, next) => {
    const id = req.params.id;
    const { width, height, left, top } = req.body;
    const image = await imagesService.getImage(id);
    const { objectName, workspaceId } = await imagesService.getImage(id);
    const filename = objectName.split('/').pop().split('?')[0];
    const index = filename.lastIndexOf('.');
    const [name, ext] = splitAtText(filename, index);
    const targetFilename = `${name}_cropped${ext}`;
    const dirname = path.join('/tmp/images/', String(workspaceId));
    fs.mkdirSync(dirname, { recursive: true });
    const localFilePath = path.join(dirname, filename);
    const targetFilePath = path.join(dirname, targetFilename);
    logger.debug('localFilePath:', localFilePath);
    logger.debug('targetFilePath:', targetFilePath);
    mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, async (err, presignedUrl) => {
      if (err) {
        let message;
        if (err instanceof Error) {
          message = err.message;
          if (err.stack) {
            message += '\n' + err.stack;
          }
        } else {
          message = err.toString();
        }
        logger.error(message);
        return res.json({
          errors: [{ message }],
        });
      }
      logger.debug('presigned url:', presignedUrl);
      const u = new URL(presignedUrl);
      const imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
      await downloadImage(imageUrl, localFilePath);
      gm(localFilePath)
        .crop(width, height, left, top)
        .write(targetFilePath, (err) => {
          if (err) {
            let message;
            if (err instanceof Error) {
              message = err.message;
              if (err.stack) {
                message += '\n' + err.stack;
              }
            } else {
              message = err.toString();
            }
            logger.error(message);
            return res.json({
              errors: [{ message }],
            });
          }
          const metadata = {
            'Content-Type': 'image/png',
          };
          const objectName = path.join(String(workspaceId), constants.IMAGES_PREFIX, targetFilename);
          logger.debug('bucket:', constants.FILE_BUCKET);
          logger.debug('objectName:', objectName);
          mc.fPutObject(constants.FILE_BUCKET, objectName, targetFilePath, metadata, (err, etag) => {
            if (err) {
              let message;
              if (err instanceof Error) {
                message = err.message;
                if (err.stack) {
                  message += '\n' + err.stack;
                }
              } else {
                message = err.toString();
              }
              logger.error(message);
              return res.json({
                errors: [{ message }],
              });
            }
            logger.info('File uploaded successfully.');
            mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
              if (err) {
                let message;
                if (err instanceof Error) {
                  message = err.message;
                  if (err.stack) {
                    message += '\n' + err.stack;
                  }
                } else {
                  message = err.toString();
                }
                logger.error(message);
                return res.json({
                  errors: [{ message }],
                });
              }
              logger.debug('presignedUrl:', presignedUrl);
              let imageUrl;
              if (constants.ENV === 'dev') {
                const u = new URL(presignedUrl);
                imageUrl = '/api/dev/images' + u.pathname + u.search;
              } else {
                imageUrl = presignedUrl;
              }
              res.json({ imageUrl, objectName });
            });
          });
        });
    });
  });

  app.post('/api/images/:id/create-mask', auth, async (req, res, next) => {
    const id = req.params.id;
    const { width, height, left, top } = req.body;
    const image = await imagesService.getImage(id);
    const { objectName, workspaceId } = await imagesService.getImage(id);
    const filename = objectName.split('/').pop().split('?')[0];
    const index = filename.lastIndexOf('.');
    const [name, ext] = splitAtText(filename, index);
    const targetFilename = `${name}_mask${ext}`;
    const dirname = path.join('/tmp/images/', String(workspaceId));
    fs.mkdirSync(dirname, { recursive: true });
    const localFilePath = path.join(dirname, filename);
    const targetFilePath = path.join(dirname, targetFilename);
    logger.debug('localFilePath:', localFilePath);
    logger.debug('targetFilePath:', targetFilePath);
    mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, async (err, presignedUrl) => {
      if (err) {
        let message;
        if (err instanceof Error) {
          message = err.message;
          if (err.stack) {
            message += '\n' + err.stack;
          }
        } else {
          message = err.toString();
        }
        logger.error(message);
        return res.json({
          errors: [{ message }],
        });
      }
      logger.debug('presigned url:', presignedUrl);
      const u = new URL(presignedUrl);
      const imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
      await downloadImage(imageUrl, localFilePath);
      gm(localFilePath)
        .fill('#00ffff')
        .drawRectangle(left, top, left + width, top + height)
        .type('Grayscale')
        .write(targetFilePath, (err) => {
          if (err) {
            let message;
            if (err instanceof Error) {
              message = err.message;
              if (err.stack) {
                message += '\n' + err.stack;
              }
            } else {
              message = err.toString();
            }
            logger.error(message);
            return res.json({
              errors: [{ message }],
            });
          }
          const metadata = {
            'Content-Type': 'image/png',
          };
          const objectName = path.join(String(workspaceId), constants.IMAGES_PREFIX, targetFilename);
          logger.debug('bucket:', constants.FILE_BUCKET);
          logger.debug('objectName:', objectName);
          mc.fPutObject(constants.FILE_BUCKET, objectName, targetFilePath, metadata, (err, etag) => {
            if (err) {
              let message;
              if (err instanceof Error) {
                message = err.message;
                if (err.stack) {
                  message += '\n' + err.stack;
                }
              } else {
                message = err.toString();
              }
              logger.error(message);
              return res.json({
                errors: [{ message }],
              });
            }
            logger.info('File uploaded successfully.');
            mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
              if (err) {
                let message;
                if (err instanceof Error) {
                  message = err.message;
                  if (err.stack) {
                    message += '\n' + err.stack;
                  }
                } else {
                  message = err.toString();
                }
                logger.error(message);
                return res.json({
                  errors: [{ message }],
                });
              }
              logger.debug('presignedUrl:', presignedUrl);
              let imageUrl;
              if (constants.ENV === 'dev') {
                const u = new URL(presignedUrl);
                imageUrl = '/api/dev/images' + u.pathname + u.search;
              } else {
                imageUrl = presignedUrl;
              }
              res.json({ imageUrl, objectName });
            });
          });
        });
    });
  });

  app.post('/api/bulk-images', auth, async (req, res, next) => {
    const { username } = req.user;
    const { images } = req.body;
    const ims = [];
    for (const im of images) {
      let imageUri;
      let objectName;
      if (im.objectName) {
        imageUri = im.imageUri;
        objectName = im.objectName
      } else {
        const dirname = path.join('/tmp/images/', String(im.workspaceId));
        await fs.promises.mkdir(dirname, { recursive: true });
        const res = await saveImage(im.workspaceId, dirname, im.imageUrl);
        imageUri = res.imageUrl;
        objectName = res.objectName;
      }
      ims.push({ ...im, imageUri, objectName });
    }

    let promises = ims.map(im => imagesService.upsertImage(im, username));
    const upsertedImages = await Promise.all(promises);
    res.json(upsertedImages);
  });

  function getFilesizeInBytes(filename) {
    var stats = fs.statSync(filename);
    var fileSizeInBytes = stats.size;
    return fileSizeInBytes;
  }

  app.post('/api/images', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    const image = await imagesService.upsertImage(values, username);
    res.json(image);
  });

  app.post('/api/presignedurls', auth, async (req, res, next) => {
    const { objectNames } = req.body;
    const promises = objectNames.map(getPresignedUrl);
    const response = await Promise.all(promises);
    res.send(response);
  });

  const saveImage = (workspaceId, dirname, url) => {
    logger.debug('save image at url:', url);
    return new Promise(async (resolve, reject) => {
      // const imageUrl = new URL(url);
      // const filename = imageUrl.pathname.substring(imageUrl.pathname.lastIndexOf('/') + 1);
      const filename = url.split('/').pop().split('?')[0];
      const localFilePath = path.join(dirname, filename);
      logger.debug('localFilePath:', localFilePath);
      let myurl;
      if (url.startsWith('http')) {
        myurl = url;
      } else {
        myurl = constants.BASE_URL + url;
      }
      await downloadImage(myurl, localFilePath);
      const metadata = {
        'Content-Type': 'image/png',
      };
      const objectName = path.join(String(workspaceId), constants.IMAGES_PREFIX, filename);
      logger.debug('bucket:', constants.FILE_BUCKET);
      logger.debug('objectName:', objectName);
      mc.fPutObject(constants.FILE_BUCKET, objectName, localFilePath, metadata, (err, etag) => {
        if (err) {
          let message;
          if (err instanceof Error) {
            message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
          } else {
            message = err.toString();
          }
          logger.error(message);
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
          if (err) {
            let message;
            if (err instanceof Error) {
              message = err.message;
              if (err.stack) {
                message += '\n' + err.stack;
              }
            } else {
              message = err.toString();
            }
            logger.error(message);
            return reject(err);
          }
          logger.debug('presignedUrl:', presignedUrl);
          let imageUrl;
          if (constants.ENV === 'dev') {
            const u = new URL(presignedUrl);
            imageUrl = '/api/dev/images' + u.pathname + u.search;
          } else {
            imageUrl = presignedUrl;
          }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  const getPresignedUrl = (objectName) => {
    return new Promise((resolve, reject) => {
      mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
        if (err) {
          let message;
          if (err instanceof Error) {
            message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
          } else {
            message = err.toString();
          }
          logger.error(message);
          return reject(err);
        }
        logger.debug('presignedUrl:', presignedUrl);
        let imageUri;
        if (constants.ENV === 'dev') {
          const u = new URL(presignedUrl);
          imageUri = '/api/dev/images' + u.pathname + u.search;
        } else {
          imageUri = presignedUrl;
        }
        resolve(imageUri);
      });
    });
  };

  const splitAtText = (str, index) => {
    return [str.substring(0, index), str.substring(index)];
  };

  const fontSizes = [72, 64, 56, 48, 36, 28, 24, 22, 18, 16, 14];

  // using canvas which I don't think has access to the same fonts
  // and therefore sizing is wrong
  // const getTextDims = (text, font, maxWidth, start = 0) => {
  //   const sizes = fontSizes.slice(start);
  //   for (const fontSize of sizes) {
  //     const canvas = createCanvas();
  //     const ctx = canvas.getContext('2d');
  //     ctx.font = `${fontSize}px ${font}`;
  //     const { actualBoundingBoxAscent, actualBoundingBoxDescent, width } = ctx.measureText(text);
  //     if (width <= maxWidth) {
  //       return {
  //         fontSize,
  //         width,
  //         height: actualBoundingBoxAscent + actualBoundingBoxDescent,
  //       };
  //     }
  //   }
  //   return null;
  // }

  const getSize = (font, fontSize, text, localFilePath) => {
    return new Promise((resolve, reject) => {
      gm(1024, 256, '#ddff99f3')
        .font(font, fontSize)
        .drawText(10, 100, text)
        .trim()
        .write(localFilePath, (err) => {
          if (err) {
            return reject(err);
          }
          gm(localFilePath)
            .size((err, dims) => {
              if (err) {
                return reject(err);
              }
              resolve(dims);
            });
        });
    });
  }

  const getTextDims = async (text, font, maxWidth, start = 0) => {
    const sizes = fontSizes.slice(start);
    const localFilePath = '/tmp/' + uuid.v4() + '.png';
    try {
      for (const fontSize of sizes) {
        logger.debug('getSize:', font, fontSize, text, localFilePath);
        const { width, height } = await getSize(font, fontSize, text, localFilePath);
        if (width <= maxWidth) {
          fs.unlinkSync(localFilePath);
          return {
            fontSize,
            width,
            height,
          };
        }
      }
      return null;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      throw err;
    }
  }

  app.post('/api/annotate-image', auth, async (req, res) => {
    const {
      blurTextBackground,
      coordinates,
      font = 'Helvetica',
      imageId,
      subText,
      textBackgroundTransparency,
      textColor = '#fff',
      textOverlay,
      textPlacement,
    } = req.body;
    const { objectName, workspaceId } = await imagesService.getImage(imageId);
    const filename = objectName.split('/').pop().split('?')[0];
    const index = filename.lastIndexOf('.');
    const [name, ext] = splitAtText(filename, index);
    const targetFilename = `${name}_annotated${ext}`;
    const dirname = path.join('/tmp/images/', String(workspaceId));
    fs.mkdirSync(dirname, { recursive: true });
    const localFilePath = path.join(dirname, filename);
    const targetFilePath = path.join(dirname, targetFilename);
    logger.debug('localFilePath:', localFilePath);
    logger.debug('targetFilePath:', targetFilePath);
    mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, async (err, presignedUrl) => {
      if (err) {
        let message;
        if (err instanceof Error) {
          message = err.message;
          if (err.stack) {
            message += '\n' + err.stack;
          }
        } else {
          message = err.toString();
        }
        logger.error(message);
        return res.json({
          errors: [{ message }],
        });
      }
      logger.debug('presigned url:', presignedUrl);
      const u = new URL(presignedUrl);
      const imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
      await downloadImage(imageUrl, localFilePath);
      gm(localFilePath).size(async (err, size) => {
        if (err) {
          let message;
          if (err instanceof Error) {
            message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
          } else {
            message = err.toString();
          }
          logger.error(message);
          return reject(err);
        }
        let maxWidth;
        if (coordinates?.width) {
          maxWidth = coordinates.width;
        } else {
          maxWidth = (size.width - 60) * .7;
        }
        const textOverlayDims = await getTextDims(textOverlay, font, maxWidth);
        logger.debug('textOverlayDims:', textOverlayDims);
        const index = fontSizes.indexOf(textOverlayDims.fontSize);
        let subTextDims;
        if (subText) {
          subTextDims = await getTextDims(subText, font, maxWidth, index + 1);
        } else {
          subTextDims = { width: 0, height: 0, fontSize: 0 };
        }
        const maxTextWidth = Math.max(textOverlayDims.width, subTextDims.width);
        let textOverlayX, textOverlayY;
        let subTextX, subTextY;
        if (coordinates?.width) {
          const { left, top } = coordinates;
          textOverlayX = left;
          subTextX = left;
          textOverlayY = top + textOverlayDims.height;
          subTextY = textOverlayY + subTextDims.height + 20;
        } else if (['top-left', 'middle-left', 'bottom-left'].includes(textPlacement)) {
          const x = 30;
          textOverlayX = x;
          subTextX = x;
        } else if (['top-center', 'middle-center', 'bottom-center'].includes(textPlacement)) {
          const x = Math.floor((size.width - maxTextWidth) / 2);
          textOverlayX = x;
          subTextX = x;
        } else if (['top-right', 'middle-right', 'bottom-right'].includes(textPlacement)) {
          const x = Math.floor(size.width - maxTextWidth - 30);
          textOverlayX = x;
          subTextX = x;
        }
        if (['top-left', 'top-center', 'top-right'].includes(textPlacement)) {
          textOverlayY = 100;
          subTextY = textOverlayY + subTextDims.height + 20;
        } else if (['middle-left', 'middle-center', 'middle-right'].includes(textPlacement)) {
          const totalTextHeight = textOverlayDims.height + subTextDims.height + 20;
          const y = Math.floor((size.height - totalTextHeight) / 2);
          textOverlayY = Math.floor(y + textOverlayDims.height);
          subTextY = Math.floor(textOverlayY + subTextDims.height + 20);
        } else if (['bottom-left', 'bottom-center', 'bottom-right'].includes(textPlacement)) {
          const totalTextHeight = textOverlayDims.height + subTextDims.height + 20;
          const y = Math.floor(size.height - totalTextHeight - 100);
          textOverlayY = Math.floor(y + textOverlayDims.height);
          subTextY = Math.floor(textOverlayY + subTextDims.height + 20);
        }
        let g = gm(localFilePath)
        if (textBackgroundTransparency) {
          g = g
            .fill('#000000' + transparencyHexCodes[textBackgroundTransparency])
            .drawRectangle(
              Math.max(textOverlayX - 20),
              Math.max(textOverlayY - textOverlayDims.height - 20, 0),
              Math.min(textOverlayX + maxTextWidth + 20, size.width),
              Math.min(textOverlayY + 20 + subTextDims.height, size.height)
            );
        }
        g = g
          .font(font, textOverlayDims.fontSize)
          .stroke(textColor)
          .fill(textColor)
          .drawText(textOverlayX, textOverlayY, textOverlay);
        if (subText) {
          g = g
            .font(font, subTextDims.fontSize)
            .drawText(subTextX, subTextY, subText);
        }
        g.write(targetFilePath, (err) => {
          if (err) {
            let message;
            if (err instanceof Error) {
              message = err.message;
              if (err.stack) {
                message += '\n' + err.stack;
              }
            } else {
              message = err.toString();
            }
            logger.error(message);
            return res.json({
              errors: [{ message }],
            });
          }
          const metadata = {
            'Content-Type': 'image/png',
          };
          const objectName = path.join(String(workspaceId), constants.IMAGES_PREFIX, targetFilename);
          logger.debug('bucket:', constants.FILE_BUCKET);
          logger.debug('objectName:', objectName);
          mc.fPutObject(constants.FILE_BUCKET, objectName, targetFilePath, metadata, (err, etag) => {
            if (err) {
              let message;
              if (err instanceof Error) {
                message = err.message;
                if (err.stack) {
                  message += '\n' + err.stack;
                }
              } else {
                message = err.toString();
              }
              logger.error(message);
              return res.json({
                errors: [{ message }],
              });
            }
            logger.info('File uploaded successfully.');
            mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, (err, presignedUrl) => {
              if (err) {
                let message;
                if (err instanceof Error) {
                  message = err.message;
                  if (err.stack) {
                    message += '\n' + err.stack;
                  }
                } else {
                  message = err.toString();
                }
                logger.error(message);
                return res.json({
                  errors: [{ message }],
                });
              }
              logger.debug('presignedUrl:', presignedUrl);
              let imageUrl;
              if (constants.ENV === 'dev') {
                const u = new URL(presignedUrl);
                imageUrl = '/api/dev/images' + u.pathname + u.search;
              } else {
                imageUrl = presignedUrl;
              }
              res.json({ imageUrl, objectName });
            });
          });
        });
      })
    });
  });

  app.put('/api/images/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const image = await imagesService.upsertImage({ id, ...values }, username);
    res.json(image);
  });

  app.put('/api/images', auth, async (req, res, next) => {
    const { username } = req.user;
    const imagesInput = req.body;
    const promises = imagesInput.map((im) => imagesService.upsertImage(im, username));
    const images = await Promise.all(promises);
    res.json(images);
  });

  app.delete('/api/images/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    await imagesService.deleteImages([id]);
    res.json(id);
  });

  app.delete('/api/images', auth, async (req, res, next) => {
    const { ids } = req.query;
    const idArray = ids.split(',');
    await imagesService.deleteImages(idArray);
    res.json(idArray);
  });

  app.get('/api/dev/images/*', async (req, res, next) => {
    const protocol = constants.ENV === 'dev' ? 'http' : 'https';
    const url = protocol + '://' + constants.S3_ENDPOINT + ':' + constants.S3_PORT + req.originalUrl.slice('/api/dev/images'.length);
    logger.debug('url:', url);
    const resp = await axios.get(url, {
      responseType: 'stream',
    });
    for (const key in resp.headers) {
      if (resp.headers.hasOwnProperty(key)) {
        const element = resp.headers[key];
        res.header(key, element);
      }
    }
    res.status(resp.status);
    resp.data.pipe(res);
  });

  app.get('/api/proxy/images/*', async (req, res) => {
    const objectName = decodeURI(req.originalUrl.slice('/api/proxy/images/'.length));
    logger.debug('objectName:', objectName);
    mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, async (err, presignedUrl) => {
      if (err) {
        logger.error(err);
        return res.sendStatus(500);
      }
      logger.debug('presignedUrl:', presignedUrl);
      try {
        const resp = await axios.get(presignedUrl, {
          responseType: 'stream',
        });
        for (const key in resp.headers) {
          if (resp.headers.hasOwnProperty(key)) {
            const element = resp.headers[key];
            res.header(key, element);
          }
        }
        res.status(resp.status);
        resp.data.pipe(res);
      } catch (err) {
        logger.error(err);
        return res.sendStatus(500);
      }
    });
  });

}