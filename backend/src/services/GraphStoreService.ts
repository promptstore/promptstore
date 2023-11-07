import {
  Graph,
  GraphStore,
  GraphStoreEnum,
  GraphStoreService,
} from '../core/indexers/GraphStore';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function GraphStoreService({ logger, registry }: PluginServiceParams): GraphStoreService {

  async function addGraph(graphstore: GraphStoreEnum, graph: Graph) {
    logger.debug('add graph, graphstore:', graphstore);
    const instance = registry[graphstore] as GraphStore;
    return instance.addGraph(graph);
  };

  async function dropData(graphstore: GraphStoreEnum) {
    logger.debug('drop data, graphstore:', graphstore);
    const instance = registry[graphstore] as GraphStore;
    return instance.dropData();
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
    getGraphStores,
  }

}
