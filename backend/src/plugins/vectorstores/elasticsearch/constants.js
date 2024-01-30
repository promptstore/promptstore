export default {
  ES_SERVER: process.env.ES_SERVER,
  ES_PORT: process.env.ES_PORT,
  ES_SSL: process.env.ES_SSL,
  ES_USER: process.env.ES_USER,
  ES_PASS: process.env.ES_PASS,
  ENV: process.env.ENV?.toLowerCase(),
}