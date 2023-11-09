import { JSONSchema7 } from 'json-schema';

import { Neo4jSchemaParams } from './Extractor';
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

export type SchemaParams = Neo4jSchemaParams;

export interface GraphStoreService {

  addGraph(graphstore: GraphStoreEnum, indexName: string, graph: Graph): void;

  dropData(graphstore: GraphStoreEnum, indexName: string): void;

  getSchema(graphstore: GraphStoreEnum, params?: Partial<SchemaParams>): Promise<JSONSchema7>;

  getGraphStores(): PluginMetadata[];

}

export abstract class GraphStore {

  __name: string;


  protected executionsService: any;
  protected graphStoreService: GraphStoreService;

  constructor(indexName: string, { executionsService, graphStoreService }) {
    this.__name = indexName;
    this.executionsService = executionsService;
    this.graphStoreService = graphStoreService;
  }

  static create(graphstore: GraphStoreEnum, indexName: string, services: GraphStoreServicesParams) {
    switch (graphstore) {
      case GraphStoreEnum.neo4j:
        return new Neo4jGraphStore(indexName, services);

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
        maxTokens: 4096,
      },
    });
    if (errors) {
      throw new Error(
        'Errors caught executing function to extract graph: ' +
        errors.map((e: any) => e.message).join(', - ')
      );
    }
    const graph = response.choices[0].message.function_call.arguments;
    this.addGraph(this.__name, graph);
  }

  abstract addGraph(indexName: string, graph: Graph): void;

  abstract dropData(indexName: string): void;

  abstract getSchema(params?: Partial<SchemaParams>): Promise<JSONSchema7>;

}

export class Neo4jGraphStore extends GraphStore {

  addGraph(indexName: string, graph: Graph) {
    return this.graphStoreService.addGraph(GraphStoreEnum.neo4j, indexName, graph);
  }

  dropData(indexName: string) {
    return this.graphStoreService.dropData(GraphStoreEnum.neo4j, indexName);
  }

  getSchema(params: Partial<Neo4jSchemaParams>) {
    return this.graphStoreService.getSchema(GraphStoreEnum.neo4j, params);
  }

}
