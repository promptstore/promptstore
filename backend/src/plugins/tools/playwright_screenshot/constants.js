export default {
  FILE_BUCKET: process.env.FILE_BUCKET,
  IMAGES_PREFIX: process.env.IMAGES_PREFIX || 'images',
  WORKSPACE_ID: 1,
  PLAYWRIGHT_SCREENSHOT_DESCRIPTION: "Take a screenshot of a page at the given URL. Do not change the image URL in the response! Include the full URL including any query parameters following '?'.",
  S3_ENDPOINT: "minio.devsheds.io",
  S3_PORT: "443",
  AWS_ACCESS_KEY: "minio",
  AWS_SECRET_KEY: "zIMPl2xty67P5KoaLczB",
}