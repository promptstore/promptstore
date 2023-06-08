module.exports = ({ app, logger, passport, services }) => {

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
  app.post('/api/executions/:name', async (req, res, next) => {
    const name = req.params.name;
    const batch = req.query.batch;
    const { args, params = {} } = req.body;
    const func = await functionsService.getFunctionByName(name);

    if (!func) {
      const errors = [
        {
          message: 'Function not found',
        },
      ];
      return res.status(500).send({ errors });
    }

    const { data, errors } = await executionsService.executeFunction(func, args, params, batch);
    if (errors) {
      return res.status(500).send({ errors });
    }
    res.json(data);
  });

  app.post('/api/composition-executions/:name', async (req, res, next) => {
    const name = req.params.name;
    const { args, params = {} } = req.body;

    logger.log('debug', 'args: %s', args);
    logger.log('debug', 'params: %s', params);

    const composition = await compositionsService.getCompositionByName(name);

    if (!composition) {
      const errors = [
        {
          message: 'Composition not found',
        },
      ];
      return res.status(404).send({ errors });
    }

    const { edges, nodes } = composition.flow;
    // logger.log('debug', 'edges: %s', JSON.stringify(edges, null, 2));
    // logger.log('debug', 'nodes: %s', JSON.stringify(nodes, null, 2));

    try {
      const result = await executionsService.executeGraph(args, params, nodes, edges);
      res.json(result);
    } catch (err) {
      logger.log('error', err);
      res.sendStatus(500);
    }
  });

};