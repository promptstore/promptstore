import { Chunk } from './Chunk';
import { PluginMetadata } from './common_types';

export enum GraphStoreEnum {
  neo4j = 'neo4j',
}

export interface Node {
  id: string;
  type: string;
  properties: any;
}

export interface Relationship {
  source: Node;
  target: Node;
  type: string;
  properties: any;
}

export interface Graph {
  nodes: Node[];
  relationships: Relationship[];
}

export interface AddChunksParams {
  workspaceId: number;
  username: string;
  allowedNodes: string[];
  allowedRels: string[];
}

export interface GraphStoreServicesParams {
  executionsService: any;
  graphStoreService: GraphStoreService;
}

export interface GraphStoreService {

  addGraph(graphstore: GraphStoreEnum, graph: Graph): void;

  dropData(graphstore: GraphStoreEnum): void;

  getGraphStores(): PluginMetadata[];

}

export abstract class GraphStore {

  __name: string;

  protected executionsService: any;
  protected graphStoreService: GraphStoreService;

  constructor({ executionsService, graphStoreService }) {
    this.executionsService = executionsService;
    this.graphStoreService = graphStoreService;
  }

  static create(graphstore: GraphStoreEnum, services: GraphStoreServicesParams) {
    switch (graphstore) {
      case GraphStoreEnum.neo4j:
        return new Neo4jGraphStore(services);

      default:
        return null;
    }
  }

  addChunks(chunks: Chunk[], params: Partial<AddChunksParams>) {
    for (const chunk of chunks) {
      this.addChunk(chunk, params);
    }
  }

  async addChunk(chunk: Chunk, params: Partial<AddChunksParams>) {
    const {
      workspaceId,
      username,
      allowedNodes,
      allowedRels,
    } = params;
    const { response, errors } = await this.executionsService.executeFunction({
      workspaceId,
      username,
      semanticFunctionName: 'extract_graph',
      args: {
        content: chunk.text,
        allowedNodes,
        allowedRels,
      },
      params: {
        maxTokens: 1024,
      },
    });
    if (errors) {
      throw new Error(
        'Errors caught executing function to extract graph: ' +
        errors.map((e: any) => e.message).join(', - ')
      );
    }
    const graph = response.choices[0].message.function_call.arguments;
    this.addGraph(graph);
  }

  abstract addGraph(graph: Graph): void;

  abstract dropData(): void;

}

export class Neo4jGraphStore extends GraphStore {

  addGraph(graph: Graph) {
    return this.graphStoreService.addGraph(GraphStoreEnum.neo4j, graph);
  }

  dropData() {
    return this.graphStoreService.dropData(GraphStoreEnum.neo4j);
  }

}
