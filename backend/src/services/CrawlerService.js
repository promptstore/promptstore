const { PlaywrightCrawler, Dataset } = require('crawlee');

function CrawlerService({ logger }) {

  async function crawl(url, spec, maxRequestsPerCrawl) {

    logger.debug('url: ', url);
    logger.debug('spec: ', JSON.stringify(spec, null, 2));
    logger.debug('maxRequestsPerCrawl: ', maxRequestsPerCrawl);

    const dataset = await Dataset.open('mydataset');

    const crawler = new PlaywrightCrawler({

      maxRequestsPerCrawl,

      async requestHandler({ request, page, enqueueLinks, log }) {
        const title = await page.title();
        log.info(`Title of ${request.loadedUrl} is '${title}'`);

        let data;
        if (spec.type === 'array') {
          const selector = spec.title;
          await page.waitForSelector(selector);
          data = await page.$$eval(selector, (els) => {
            return els.map((el) => el.textContent);
          });
        }

        // Save results as JSON to ./storage/datasets/default
        dataset.pushData({
          title,
          url: request.loadedUrl,
          data,
        });

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

module.exports = { CrawlerService };