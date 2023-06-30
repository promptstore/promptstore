module.exports = ({ app, auth, logger, services }) => {

  const { crawlerService, indexesService, searchService } = services;

  app.post('/api/crawls', async (req, res) => {
    const { url, spec, maxRequestsPerCrawl, indexId, newIndexName, engine } = req.body;
    const schema = convertScrapingSpecToIndexSchema(spec);
    logger.debug('schema: ', JSON.stringify(schema, null, 2));
    let indexName;
    if (indexId === 'new') {
      const id = await indexesService.upsertIndex({
        name: newIndexName,
        engine,
        schema,
      });
      logger.debug(`Created new index '${newIndexName}' [${id}]`);
      const fields = searchService.getSearchSchema(schema);
      await searchService.createIndex(newIndexName, fields);
      indexName = newIndexName;
    } else {
      const index = await indexesService.getIndex(indexId);

      if (!index) {
        logger.error('Index not found');
        return res.sendStatus(404);
      }

      indexName = index.name;
    }
    const data = await crawlerService.crawl(url, spec, maxRequestsPerCrawl);
    logger.debug('data: ', JSON.stringify(data, null, 2));

    // index data
    const promises = [];
    for (const item of data.items) {
      if (spec.type === 'array') {
        for (const value of item.data) {
          let doc;
          if (spec.items.type === 'string') {
            doc = {
              text: value,
              url: item.url,
              page_title: item.title,
              nodeType: 'content',
            };
          } else {  // `items.type === 'object'`
            doc = {
              ...value,
              url: item.url,
              page_title: item.title,
              nodeType: 'content',
            };
          }
          const promise = searchService.indexDocument(indexName, doc);
          promises.push(promise);
        }
      }
    }
    await Promise.all(promises);
    res.sendStatus(200);
  });

  const typeMappings = {
    string: 'String',
    number: 'Integer',
  };

  const convertScrapingSpecToIndexSchema = ({ items, type }) => {
    const schema = { content: {} };
    if (type === 'array') {
      if (items.type === 'string') {
        schema.content = convertStringToIndexSchema();
      }
      if (items.type === 'object') {
        schema.content = convertObjectToIndexSchema(items);
      }
    } else if (type === 'string') {
      schema.content = convertStringToIndexSchema();
    } else if (type === 'object') {
      schema.content = convertObjectToIndexSchema(spec);
    }
    schema.content = {
      ...schema.content,
      url: {
        name: 'url',
        dataType: 'String',
        mandatory: true,
      },
      page_title: {
        name: 'page_title',
        dataType: 'String',
        mandatory: true,
      },
    }
    return schema;
  };

  const convertObjectToIndexSchema = ({ properties }) => {
    return Object.entries(properties).reduce((a, [k, v]) => {
      a[k] = {
        name: k,
        dataType: typeMappings[v.type] || 'String',
        mandatory: false,
      }
      return a;
    }, {});
  };

  const convertStringToIndexSchema = () => {
    return {
      text: {
        name: 'text',
        dataType: 'Vector',
        mandatory: true,
      },
    };
  };

};
