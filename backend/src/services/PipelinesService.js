import { Pipeline } from '../core/indexers/Pipeline';

export function PipelinesService({ logger, services }) {

  const {
    executionsService,
    extractorService,
    functionsService,
    graphStoreService,
    indexesService,
    llmService,
    loaderService,
    modelsService,
    uploadsService,
    vectorStoreService,
  } = services;

  const executePipeline = async (params, loaderProvider, extractorProviders) => {
    const { workspaceId } = params;
    try {
      let embeddingModel;
      if (params.embeddingModel) {
        const model = await modelsService.getModelByKey(workspaceId, params.embeddingModel);
        if (model) {
          embeddingModel = {
            provider: model.provider,
            model: model.key,
          };
        }
      }

      let objectNames;
      if (params.documents?.length) {
        objectNames = [];
        for (const uploadId of params.documents) {
          const upload = await uploadsService.getUpload(uploadId);
          const objectName = `${workspaceId}/documents/${upload.filename}`;
          objectNames.push({
            uploadId,
            objectName,
          });
        }
      }

      const pipeline = new Pipeline({
        executionsService,
        extractorService,
        functionsService,
        graphStoreService,
        indexesService,
        llmService,
        loaderService,
        vectorStoreService,
      }, {
        loaderProvider,
        extractorProviders,
      });
      const index = await pipeline.run({ ...params, embeddingModel, objectNames, documents: null });
      return index;
    } catch (err) {
      logger.error(err);
      throw err;
    }
  }

  return {
    executePipeline,
  };
}
