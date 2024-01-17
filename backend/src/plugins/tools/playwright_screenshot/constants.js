export default {
  FILE_BUCKET: process.env.FILE_BUCKET,
  IMAGES_PREFIX: process.env.IMAGES_PREFIX || 'images',
  WORKSPACE_ID: process.env.WORKSPACE_ID,
  PLAYWRIGHT_SCREENSHOT_DESCRIPTION: "Take a screenshot of a page at the given URL. Do not change the image URL in the response! Include the full URL including any query parameters following '?'.",
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_PORT: process.env.S3_PORT,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
  ENV: process.env.ENV,
  BASE_URL: process.env.BASE_URL,
}