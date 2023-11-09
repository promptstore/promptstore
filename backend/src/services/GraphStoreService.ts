import {
  Graph,
  GraphStore,
  GraphStoreEnum,
  GraphStoreService,
  SchemaParams,
} from '../core/indexers/GraphStore';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function GraphStoreService({ logger, registry }: PluginServiceParams): GraphStoreService {

  async function addGraph(graphstore: GraphStoreEnum, indexName: string, graph: Graph) {
    logger.debug("add graph to index '%s', graphstore:", indexName, graphstore);
    const instance = registry[graphstore] as GraphStore;
    return instance.addGraph(indexName, graph);
  };

  async function dropData(graphstore: GraphStoreEnum, indexName: string) {
    logger.debug("drop data from index '%s', graphstore:", indexName, graphstore);
    const instance = registry[graphstore] as GraphStore;
    return instance.dropData(indexName);
  };

  function getSchema(graphstore: GraphStoreEnum, params: SchemaParams) {
    logger.debug('get schema, graphstore:', graphstore);
    const instance = registry[graphstore] as GraphStore;
    return instance.getSchema(params);
  };

  function getGraphStores() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    addGraph,
    dropData,
    getSchema,
    getGraphStores,
  }

}
