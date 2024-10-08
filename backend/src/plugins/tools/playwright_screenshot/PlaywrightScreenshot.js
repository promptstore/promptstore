import Minio from 'minio';
import path from 'path';
import { expect } from '@playwright/test';
import { chromium } from 'playwright-extra';
import stealthmod from 'puppeteer-extra-plugin-stealth';
// import recaptchamod from 'puppeteer-extra-plugin-recaptcha';
// import { solve } from 'recaptcha-solver';

function PlaywrightScreenshot({ __key, __name, constants, logger }) {

  const mc = new Minio.Client({
    endPoint: constants.S3_ENDPOINT,
    port: parseInt(constants.S3_PORT, 10),
    useSSL: constants.ENV !== 'dev',
    accessKey: constants.AWS_ACCESS_KEY,
    secretKey: constants.AWS_SECRET_KEY,
  });

  const stealth = stealthmod();
  // const recaptcha = recaptchamod();

  chromium.use(stealth);
  // chromium.use(recaptcha);

  let _context;

  async function getContext() {
    // if (!_context || !_context.isConnected()) {
    if (!_context) {
      // Launch the browser
      // _browser = await chromium.launch({ headless: true });
      const browser = await chromium.launch();

      // Create a new browser context
      _context = await browser.newContext();

      // Add an authentication cookie
      // await _context.addCookies([
      //   {
      //     name: '',
      //     value: '',
      //     path: '/',
      //     domain: '',
      //   }
      // ]);
    }
    return _context;
  }

  async function call({ input, imageSize, domainParams }, raw) {
    logger.debug('evaluating input:', input, { raw });
    let url;
    try {
      url = new URL(input);
    } catch (err) {
      logger.error('Input "%s" is not a valid URL', input);
      if (raw) {
        return { imageUrls: [], objectNames: [] };
      }
      return "I don't know how to do that.";
    }

    const hostname = url.hostname;
    if (!imageSize) {
      imageSize = 'fullPage';
    }
    let context;
    try {
      context = await getContext();
      const page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 1080 });

      try {
        // default timeout is 30 seconds
        await page.goto(input, { waitUntil: 'networkidle' });
      } catch (err) {
        logger.debug('Error waiting for page to load:', err);
        // continue
      }

      await delay(10000);

      // try {
      //   await solve(page);
      // } catch (err) {
      //   // continue
      // }
      // await page.click(':has-text("Reject all cookies")');
      // await page.click(':has-text("Close")');

      logger.debug('domain params:', domainParams);
      if (domainParams) {
        const params = domainParams.find(p => hostname.includes(p.hostname));
        if (params) {
          const { hostname, hasCookieConsent, iframeSelector, buttonSelector } = params;
          logger.debug('hostname:', hostname);
          logger.debug('cookie consent:', hasCookieConsent);
          logger.debug('iframe selector:', iframeSelector);
          logger.debug('button selector:', buttonSelector);
          if (hasCookieConsent && buttonSelector) {
            // await new Promise(resolve => setTimeout(resolve, 5000));
            try {
              if (iframeSelector) {
                const frame = await page.frameLocator(iframeSelector);
                await frame.locator(buttonSelector).click();
              } else {
                await page.locator(buttonSelector).click();
              }
            } catch (err) {
              logger.debug('Error finding button to accept cookies:', err);
              // continue
            }
            try {
              // wait until the cookie consent dialog is closed
              if (iframeSelector) {
                const frame = await page.frameLocator(iframeSelector);
                await expect(frame.locator(buttonSelector)).toHaveCount(0);
              } else {
                await expect(page.locator(buttonSelector)).toHaveCount(0);
              }
            } catch (err) {
              logger.debug('Error waiting for cookie consent dialog to close:', err);
              // continue
            }
            // TODO hack - wait until the cookie consent dialog is closed
            // await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }
      }

      const filename = (hostname + '_' + url.pathname.split('/').pop().split('?')[0])
        .replace(/(\.|%[A-Fa-f0-9]{2})/g, '_') + '.png';
      const localFilePath = constants.FILESTORE_PREFIX + '/var/data/images/' + filename;
      await page.screenshot({ path: localFilePath, fullPage: imageSize === 'fullPage' });
      const { imageUrl, objectName } = await saveImage(localFilePath);
      if (raw) {
        return { imageUrls: [imageUrl], objectNames: [objectName] };
      }
      // return JSON.stringify({ imageUrl });
      return 'Image URL: ' + imageUrl;
    } catch (err) {
      logger.error(`error evaluating url input "${input}":`, err);
      if (raw) {
        return { imageUrls: [], objectNames: [] };
      }
      return "I don't know how to do that.";
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  function saveImage(localFilePath) {
    return new Promise(async (resolve, reject) => {
      const filename = localFilePath.split('/').pop();
      const objectName = path.join(String(constants.WORKSPACE_ID), constants.IMAGES_PREFIX, filename);
      logger.debug('bucket:', constants.FILE_BUCKET);
      logger.debug('objectName:', objectName);
      const metadata = {
        'Content-Type': 'image/png',
      };
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
          logger.debug('presigned url:', presignedUrl);
          let imageUrl;
          // if (constants.ENV === 'dev') {
          const u = new URL(presignedUrl);
          imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
          // } else {
          //   imageUrl = presignedUrl;
          // }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.PLAYWRIGHT_SCREENSHOT_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input URL',
            type: 'string',
          },
          imageSize: {
            description: 'One of ["fullPage", "aboveTheFold"]',
            type: 'string',
          },
          domainParams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hostname: {
                  type: 'string',
                  description: 'The hostname part of the Input URL',
                },
                hasCookieConsent: {
                  type: 'boolean',
                  description: 'Indicates if the URL has a cookie consent dialog',
                },
                iframeSelector: {
                  type: 'string',
                  description: 'The CSS selector to find the iframe of the cookie consent dialog',
                },
                buttonSelector: {
                  type: 'string',
                  description: 'The CSS selector to find the button for cookie consent acceptance',
                },
              },
            },
          },
        },
        required: ['input'],
        type: 'object',
      },
      returns: {
        type: 'object',
        properties: {
          imageUrls: {
            description: 'A list of Image URLs. Generally, we are only interested in the first one.',
            type: 'array',
            items: {
              description: 'The image URL.',
              type: 'string',
            },
          },
          objectNames: {
            description: 'A list of paths that reference the saved image in the object store.',
            type: 'array',
            items: {
              description: 'The object store path including bucket, prefix, and file name.',
              type: 'string',
            },
          },
        },
      },
    };
  }

  const delay = (t) => {
    return new Promise((resolve) => {
      setTimeout(resolve, t);
    })
  };

  return {
    __name,
    __description: constants.PLAYWRIGHT_SCREENSHOT_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };
}

export default PlaywrightScreenshot;