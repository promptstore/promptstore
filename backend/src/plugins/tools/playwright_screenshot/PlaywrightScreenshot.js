import Minio from 'minio';
import path from 'path';
import { chromium } from 'playwright-extra';
import stealthmod from 'puppeteer-extra-plugin-stealth';
// import recaptchamod from 'puppeteer-extra-plugin-recaptcha';
import { solve } from 'recaptcha-solver';

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

  let _browser;

  async function getBrowser() {
    if (!_browser || !_browser.isConnected()) {
      // _browser = await chromium.launch({ headless: true });
      _browser = await chromium.launch();
    }
    return _browser;
  }

  async function call({ input, imageSize = 'fullPage' }, raw) {
    logger.debug('evaluating input:', input, { raw });
    let browser;
    try {
      browser = await getBrowser();
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 1080 });
      await page.goto(input, { waitUntil: 'networkidle' });

      // TODO hack - waiting for all images to load
      // ineffective anyway
      // await new Promise(resolve => setTimeout(resolve, 5000));

      // try {
      //   await solve(page);
      // } catch (err) {
      //   // continue
      // }
      // await page.click(':has-text("Reject all cookies")');
      // await page.click(':has-text("Close")');

      const url = new URL(input);
      const filename =
        (url.hostname + '_' + url.pathname.split('/').pop().split('?')[0])
          .replace(/(\.|%[A-Fa-f0-9]{2})/g, '_') + '.png';
      const localFilePath = '/var/data/images/' + filename;
      await page.screenshot({ path: localFilePath, fullPage: imageSize === 'fullPage' });
      const { imageUrl, objectName } = await saveImage(localFilePath);
      if (raw) {
        return { imageUrls: [imageUrl], objectNames: [objectName] };
      }
      // return 'Image URL: ' + imageUrl;
      return JSON.stringify({ imageUrl });
    } catch (err) {
      logger.error(`error evaluating url input "${input}":`, err);
      if (raw) {
        return { imageUrls: [], objectNames: [] };
      }
      return "I don't know how to do that.";
    } finally {
      if (browser) {
        await browser.close();
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
          logger.error(err);
          return reject(err);
        }
        logger.info('File uploaded successfully.');
        mc.presignedUrl('GET', constants.FILE_BUCKET, objectName, 24 * 60 * 60, (err, presignedUrl) => {
          if (err) {
            logger.error(err);
            return reject(err);
          }
          logger.debug('presigned url:', presignedUrl);
          let imageUrl;
          if (constants.ENV === 'dev') {
            const u = new URL(presignedUrl);
            imageUrl = constants.BASE_URL + '/api/dev/images' + u.pathname + u.search;
          } else {
            imageUrl = presignedUrl;
          }
          resolve({ imageUrl, objectName });
        });
      });
    });
  };

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.PLAYWRIGHT_SCREENSHOT_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Input URL',
            type: 'string',
          },
        },
        required: ['input'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.PLAYWRIGHT_SCREENSHOT_DESCRIPTION,
    call,
    getOpenAIMetadata,
  };
}

export default PlaywrightScreenshot;