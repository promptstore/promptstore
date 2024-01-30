import uuid from 'uuid';
import wiki from 'wikipedia';

function WikipediaLoader({ __name, constants, logger }) {

  async function load({
    dataSourceId,
    dataSourceName,
    query,
  }) {
    logger.debug('Loading Wikipedia entry with query: "%s"', query);
    try {
      const page = await wiki.page(query);
      const content = await page.content();
      const summary = await page.summary();
      const endpoint = summary.content_urls.desktop.page;
      const text = JSON.stringify(content);
      const size = new Blob([text]).size;
      return [
        {
          id: uuid.v4(),
          dataSourceId,
          dataSourceName,
          endpoint,
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
