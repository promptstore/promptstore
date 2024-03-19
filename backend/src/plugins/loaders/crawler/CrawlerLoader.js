import { Dataset, PlaywrightCrawler } from 'crawlee';
import uuid from 'uuid';

function CrawlerLoader({ __name, constants, logger }) {

  async function load({
    dataSourceId,
    dataSourceName,
    url,
    crawlerSpec,
    maxRequestsPerCrawl,
  }) {
    try {
      logger.debug('data source name:', dataSourceName);
      logger.debug('url:', url);
      logger.debug('crawlerSpec:', crawlerSpec);
      logger.debug('max requests per crawl:', maxRequestsPerCrawl);

      const dataset = await Dataset.open(dataSourceName);

      const crawler = new PlaywrightCrawler({

        maxRequestsPerCrawl,

        async requestHandler({ request, page, enqueueLinks, log }) {
          const title = await page.title();
          log.info(`Title of ${request.loadedUrl} is '${title}'`);
          try {
            let data;
            if (crawlerSpec.type === 'array') {
              const selector = crawlerSpec.title;
              // await page.waitForSelector(selector);
              log.debug('selector:', selector);
              data = await page.$$eval(selector, (els) => {
                return els.map((el) => el.textContent);
              });
            } else if (crawlerSpec.type === 'object') {
              const selector = crawlerSpec.title;
              // log.info('selector: ' + selector);
              // await page.waitForSelector(selector);
              const productEl = await page.locator(selector);
              // log.info('productEl: ' + productEl);
              // log.info('properties: ' + JSON.stringify(crawlerSpec.properties));
              data = {};
              for (const [k, v] of Object.entries(crawlerSpec.properties)) {
                // log.info('property: ' + k + ' ' + JSON.stringify(v));
                if (v.type === 'string') {
                  let str = await productEl.locator(v.title).allTextContents();
                  // log.info('str: ' + str);
                  str = String(str).trim();
                  if (str) {
                    data[k] = str;
                  }
                } else if (v.type === 'array') {
                  const arr = await productEl.locator(v.title).
                    evaluateAll((els) => els
                      .map((el) => {
                        let str = el.textContent;
                        str = String(str).trim();
                        return str;
                      })
                      .filter((str) => str)
                    );
                  // log.info('arr: ' + JSON.stringify(arr));
                  data[k] = arr;
                }
              }
            }
            // Save results as JSON to ./storage/datasets/{indexName}
            dataset.pushData({
              title,
              url: request.loadedUrl,
              data,
            });
          } catch (err) {
            let message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
            logger.debug(message);
            // continue
          }

          // Extract links from the current page
          // and add them to the crawling queue.
          await enqueueLinks();
        }

      });

      await crawler.run([url]);

      const data = dataset.getData();

      const documents = [];
      for (const item of data.items) {
        const doc = getDocument(dataSourceId, dataSourceName, item.url, item.title, crawlerSpec, item.data);
        documents.push(doc);
      }

      return documents;

    } catch (err) {
      logger.error(err, err.stack);
      return [];
    }
  }

  function getContent(schema, data) {
    if (schema.type === 'array') {
      return data.map(d => getContent(schema.items, d));
    }
    if (schema.type === 'object') {
      return Object.keys(schema.properties).reduce((a, key) => {
        a[key] = getContent(schema.properties[key], data[key]);
        return a;
      }, {});
    }
    return data;
  }

  function getDocument(dataSourceId, dataSourceName, endpoint, title, schema, data) {
    const content = getContent(schema, data);
    const text = JSON.stringify(content);
    const size = new Blob([text]).size;
    return {
      id: uuid.v4(),
      dataSourceId,
      dataSourceName,
      endpoint,
      mimetype: 'application/json',
      size,
      title,
      content,
    };
  }

  return {
    __name,
    load,
  };
}

export default CrawlerLoader;
