export default ({ app, auth, logger, services }) => {

  const { compositionsService, executionsService, functionsService } = services;

  /**
   * @openapi
   * components:
   *   schemas:
   *     FunctionInput:
   *       type: object
   *       properties:
   *         args:
   *           type: object
   *           description: Function arguments
   *         modelKey:
   *           type: string
   *           description: The model key
   */

  /**
   * @openapi
   * tags:
   *   name: SemanticFunctions
   *   description: The Semantic Functions API
   */

  /**
   * @openapi
   * /api/executions/:name:
   *   post:
   *     description: Execute a semantic function.
   *     tags: [SemanticFunctions]
   *     parameters:
   *       - name: name
   *         description: The function name
   *         in: path
   *         schema:
   *           type: string
   *     requestBody:
   *       description: The function parameters
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/FunctionInput'
   *     responses:
   *       200:
   *         description: The function result
   *       500:
   *         description: Error
   */
  app.post('/api/executions/:name', auth, async (req, res, next) => {
    const semanticFunctionName = req.params.name;
    const { username } = req.user;
    const { batch, stream } = req.query;
    // logger.debug('body:', req.body);

    // TODO
    const { args, history, params = {}, workspaceId = 1 } = req.body;

    const { data, errors } = await executionsService.executeFunction({
      workspaceId,
      username,
      semanticFunctionName,
      args,
      history,
      params,
      batch,
    });
    if (errors) {
      return res.status(500).send({ errors });
    }
    if (stream) {
      const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
      };
      res.writeHead(200, headers);
      data.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          const message = line.replace(/^data: /, '');
          if (message === '[DONE]') {
            // Stream finished
            res.close();
          }
          try {
            const parsed = JSON.parse(message);
            console.log(parsed.choices[0].text);
            res.write('data: ' + parsed.choices[0].text + '\n\n');
          } catch (error) {
            console.error('Could not JSON parse stream message', message, error);
          }
        }
      });
    } else {
      res.json(data);
    }
  });

  app.post('/api/composition-executions/:name', async (req, res, next) => {
    const compositionName = req.params.name;
    const { username } = req.user;
    const batch = req.query.batch;
    // logger.debug('body:', req.body);
    const { args, params = {}, workspaceId = 1 } = req.body;

    const { data, errors } = await executionsService.executeComposition({
      workspaceId,
      username,
      compositionName,
      args,
      params,
      batch,
    });
    if (errors) {
      return res.status(500).send({ errors });
    }
    res.json(data);
  });

};
