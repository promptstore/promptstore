import { JSONSchema7 } from 'json-schema';

import { Neo4jSchemaParams } from './Extractor';
import { Chunk } from './Chunk';
import { PluginMetadata } from './common_types';

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
  relationships?: Relationship[];
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

  addGraph(graphstore: string, indexName: string, graph: Graph): void;

  dropData(graphstore: string, indexName: string): void;

  getSchema(graphstore: string, params?: Partial<SchemaParams>): Promise<JSONSchema7>;

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

  static create(graphstore: string, indexName: string, services: GraphStoreServicesParams) {
    return new class extends GraphStore {

      addGraph(indexName: string, graph: Graph) {
        return this.graphStoreService.addGraph(graphstore, indexName, graph);
      }

      dropData(indexName: string) {
        return this.graphStoreService.dropData(graphstore, indexName);
      }

      getSchema(params: Partial<Neo4jSchemaParams>) {
        return this.graphStoreService.getSchema(graphstore, params);
      }

    }(indexName, services);
  }

  addChunksWithoutExtraction(chunks: Chunk[]) {
    const nodes = chunks.map(chunk => {
      const properties = Object.entries(chunk.data)
        .map(([key, value]) => ({ key, value }));
      return {
        id: chunk.id,
        type: chunk.type,
        properties,
      };
    });
    const graph = { nodes };
    this.addGraph(this.__name, graph);
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
