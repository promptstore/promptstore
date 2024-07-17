export default {
  FILE_BUCKET: process.env.FILE_BUCKET,
  IMAGES_PREFIX: process.env.IMAGES_PREFIX || 'images',
  WORKSPACE_ID: process.env.WORKSPACE_ID,
  ENV: process.env.ENV,
  STABILITY_AI_API_KEY: process.env.STABILITY_AI_API_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_PORT: process.env.S3_PORT,
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
}