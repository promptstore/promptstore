export default ({ app, auth, constants, logger, services }) => {

  const {
    agentsService,
    dataSourcesService,
    functionsService,
    indexesService,
    modelsService,
    promptSetsService,
    rulesService,
    transformationsService,
  } = services;

  app.get('/api/workspaces/:workspaceId/statistics', async (req, res, next) => {
    const { workspaceId } = req.params;
    const agentsCount = await agentsService.getAgentsCount(workspaceId);
    const dataSourcesCount = await dataSourcesService.getDataSourcesCount(workspaceId);
    const functionsCount = await functionsService.getFunctionsCount(workspaceId);
    const indexesCountByType = await indexesService.getIndexesCount(workspaceId);
    const modelsCount = await modelsService.getModelsCount(workspaceId);
    const promptSetsCount = await promptSetsService.getPromptSetsCount(workspaceId);
    const rulesCount = await rulesService.getRulesCount(workspaceId);
    const transformationsCount = await transformationsService.getTransformationsCount(workspaceId);
    res.json({
      agents: { title: 'Agents', value: agentsCount },
      'data-sources': { title: 'Data Sources', value: dataSourcesCount },
      functions: { title: 'Semantic Functions', value: functionsCount },
      indexes: { title: 'Semantic Indexes', value: indexesCountByType.vectorIndex },
      graphs: { title: 'Knowledge Graphs', value: indexesCountByType.graph },
      models: { title: 'Models', value: modelsCount },
      'prompt-sets': { title: 'Prompt Templates', value: promptSetsCount },
      rules: { title: 'Rulesets', value: rulesCount },
      transformations: { title: 'Transformations', value: transformationsCount },
    });
  });

}