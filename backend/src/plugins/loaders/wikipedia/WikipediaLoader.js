import uuid from 'uuid';
import wiki from 'wikipedia';

function WikipediaLoader({ __name, constants, logger }) {

  async function load({
    query,
  }) {
    logger.debug('Loading Wikipedia entry with query: "%s"', query);
    try {
      const page = await wiki.page(query);
      const content = await page.content();
      const text = JSON.stringify(content);
      const size = new Blob([text]).size;
      return [
        {
          id: uuid.v4(),
          query,
          mimetype: 'text/plain',
          size,
          content,
        },
      ];
    } catch (err) {
      logger.error(err, err.stack);
      return [];
    }
  }

  return {
    __name,
    load,
  };
}

export default WikipediaLoader;
