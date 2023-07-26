module.exports = {
  SERPAPI_DESCRIPTION: 'a search engine. useful for when you need to answer questions about current events. input should be a search query.',
  SERPAPI_RESULT_PREFIX: 'The following information was found. The more recent information is mentioned first and should therefore be given more weight in drawing a conclusion.',
  SERPAPI_KEY: process.env.SERPAPI_KEY,
  SERPAPI_URL: process.env.SERPAPI_URL,
}