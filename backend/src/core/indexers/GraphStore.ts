import type { Schema } from 'jsonschema';

import logger from '../../logger';

import { PluginMetadata } from '../common_types';
import { Neo4jSchemaParams } from './Extractor';
import { Chunk } from './Chunk';

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
  indexName?: string;
  nodes: Node[];
  relationships?: Relationship[];
}

interface GraphSchema {
  nodes: any[];
  edges: any[];
}

export interface AddChunksParams {
  workspaceId: number;
  username: string;
  graphSchema: GraphSchema;
}

export interface GraphStoreServicesParams {
  executionsService: any;
  graphStoreService: GraphStoreService;
}

export type SchemaParams = Neo4jSchemaParams;

export interface GraphStoreService {

  addGraph(graphstore: string, indexName: string, graph: Graph): void;

  dropData(graphstore: string, indexName: string): void;

  getGraph(graphstore: string, indexName: string): Promise<Graph>;

  getSchema(graphstore: string, params?: Partial<SchemaParams>): Promise<Schema>;

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

      getGraph(indexName: string) {
        return this.graphStoreService.getGraph(graphstore, indexName);
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
      graphSchema,
    } = params;
    const { response, errors } = await this.executionsService.executeFunction({
      workspaceId,
      username,
      semanticFunctionName: 'extract_graph',
      args: {
        content: chunk.text,
        allowedNodes: graphSchema?.nodes,
        allowedRels: graphSchema?.edges,
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
    logger.debug('response:', response);
    const graph = response.choices[0].message.function_call.arguments;
    this.addGraph(this.__name, graph);
  }

  abstract addGraph(indexName: string, graph: Graph): void;

  abstract dropData(indexName: string): void;

  abstract getGraph(indexName: string): Promise<Graph>;

  abstract getSchema(params?: Partial<SchemaParams>): Promise<Schema>;

}
