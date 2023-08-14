import { PlaywrightCrawler, Dataset } from 'crawlee';

export function CrawlerService({ logger }) {

  async function crawl(indexName, url, spec, maxRequestsPerCrawl) {

    logger.debug('indexName:', indexName);
    logger.debug('url:', url);
    logger.debug('spec:', JSON.stringify(spec, null, 2));
    logger.debug('maxRequestsPerCrawl:', maxRequestsPerCrawl);

    const dataset = await Dataset.open(indexName);

    const crawler = new PlaywrightCrawler({

      maxRequestsPerCrawl,

      async requestHandler({ request, page, enqueueLinks, log }) {
        const title = await page.title();
        log.info(`Title of ${request.loadedUrl} is '${title}'`);

        try {
          let data;
          if (spec.type === 'array') {
            const selector = spec.title;
            // await page.waitForSelector(selector);
            log.debug('selector:', selector);
            data = await page.$$eval(selector, (els) => {
              return els.map((el) => el.textContent);
            });
          } else if (spec.type === 'object') {
            const selector = spec.title;
            // log.info('selector: ' + selector);
            // await page.waitForSelector(selector);
            const productEl = await page.locator(selector);
            // log.info('productEl: ' + productEl);
            // log.info('properties: ' + JSON.stringify(spec.properties));
            data = {};
            for (const [k, v] of Object.entries(spec.properties)) {
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
          // continue
        }

        // Extract links from the current page
        // and add them to the crawling queue.
        await enqueueLinks();
      }

    });

    await crawler.run([url]);

    return dataset.getData();
  }

  return {
    crawl,
  };

}
