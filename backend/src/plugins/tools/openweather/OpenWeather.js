import { OpenWeatherAPI } from 'openweather-api-node';

const temperatureRating = (temp) => {
  if (temp < 5) {
    return 'freezing';
  }
  if (temp < 10) {
    return 'cold';
  }
  if (temp < 15) {
    return 'chilly';
  }
  if (temp < 20) {
    return 'mild';
  }
  if (temp < 30) {
    return 'glorious';
  }
  if (temp < 35) {
    return 'hot';
  }
  return 'sweltering';
};

const skyRating = (cloudsPercent) => {
  if (cloudsPercent < 10) {
    return 'a clear';
  }
  if (cloudsPercent > 85) {
    return 'an overcast';
  }
  return 'a';
}

function OpenWeather({ __key, __name, constants, logger }) {

  function getClient() {
    try {
      return new OpenWeatherAPI({
        key: constants.OPENWEATHER_API_KEY,
        units: 'metric',
      });
    } catch (err) {
      logger.error('Error getting OpenWeather API client:', err);
      return null;
    }
  }

  const client = getClient();

  async function call({ input }) {
    logger.debug('evaluating input:', input);
    try {
      client.setLocationByName(input);
      const data = await client.getCurrent();
      const w = data.weather;
      const sky = skyRating(w.clouds);
      const temp = temperatureRating(w.feelsLike.cur);
      const desc = w.description;
      return `It's ${sky} ${temp} day. The weather is ${desc}.`;
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return "I don't know how to do that.";
    }
  }

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.OPENWEATHER_DESCRIPTION,
      parameters: {
        properties: {
          input: {
            description: 'Location',
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
    __description: constants.OPENWEATHER_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };
}

export default OpenWeather;
