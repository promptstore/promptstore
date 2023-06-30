const omit = require('lodash.omit');
const pick = require('lodash.pick');

module.exports = ({ app, auth, logger, services }) => {

  const { contentService, imagesService, searchService } = services;

  app.get('/api/users/:userId/content', auth, async (req, res, next) => {
    const { userId } = req.params;
    const { limit, start } = req.query;
    const content = await contentService.getContentsForReview(userId, limit, start);
    res.json(content);
  });

  app.get('/api/apps/:appId/content', auth, async (req, res, next) => {
    const { appId } = req.params;
    const { limit, start } = req.query;
    const content = await contentService.getContents(appId, limit, start);
    res.json(content);
  });

  app.get('/api/content/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const content = await contentService.getContent(id);
    res.json(content);
  });

  app.get('/api/contents', auth, async (req, res, next) => {
    const contents = await contentService.getContentsByFilter(req.query);
    res.json(contents);
  });

  app.post('/api/contents', auth, async (req, res, next) => {
    const promises = req.body.flatMap((content) => {
      const p = [];
      p.push(contentService.upsertContent(content));
      try {
        const prom = indexContent(content);
        p.push(prom);
      } catch (err) {
        logger.debug(err);
      }
      return p;
    });
    const ids = await Promise.all(promises);
    res.json(ids);
  });

  app.post('/api/content', auth, async (req, res, next) => {
    const values = req.body;
    const id = await contentService.upsertContent(values);
    res.json(id);
  });

  app.put('/api/content/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const values = req.body;
    logger.debug('values: ', values);
    if (values.image) {
      const image = omit(values.image, ['isNew', 'isChanged']);
      await imagesService.upsertImage(image);
    }
    const content = omit(values, ['image', 'isNew', 'isChanged']);
    const resp = await contentService.upsertContent({ id, ...content });
    res.json(resp);
  });

  app.put('/api/contents', auth, async (req, res, next) => {
    const promises = req.body.flatMap((v) => {
      const p = [];
      const content = omit(v, ['image', 'isNew', 'isChanged']);
      if (v.image) {
        const image = omit(v.image, ['isNew', 'isChanged']);
        p.push(imagesService.upsertImage(image));
        content.image = pick(v.image, ['imageId', 'imageUrl', 'hash']);
      }
      p.push(contentService.upsertContent({ ...content, id: v.id }));
      return p;
    });
    const contents = await Promise.all(promises);
    res.json(contents);
  });

  app.delete('/api/content/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await contentService.deleteContents([id]);
    res.json(id);
  });

  app.delete('/api/content', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await contentService.deleteContents(ids);
    res.json(ids);
  });

  const indexContent = async (content) => {
    logger.debug('content: ', content);
    // TODO
    const workspaceId = 1;

    const indexName = 'workspace-' + workspaceId;
    const schema = {
      content: {
        text: {
          name: 'text',
          dataType: 'String',
          mandatory: true,
        },
      }
    };
    const searchSchema = searchService.getSearchSchema(schema);
    logger.debug('searchSchema: ', JSON.stringify(searchSchema, null, 2));

    let error;

    try {
      await searchService.createIndex(indexName, searchSchema);
    } catch (e) {
      if (e.response?.data.error === 'Index already exists') {
        logger.warn('Index already exists, skipped creation.');
      } else {
        logger.error(e);
        error = e;
      }
    }
    if (!error) {
      await searchService.indexDocument(indexName, {
        text: content.text,
        nodeType: 'content',
      });
    }
  }

};
