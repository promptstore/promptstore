import type { Schema } from 'jsonschema';

import { PluginMetadata } from '../common_types';
import { Chunk } from './Chunk';
import { Document } from './Document';

export interface CsvOptions {
  bom: boolean;
  columns: boolean;
  delimiter: string;
  quote: string;
  skip_records_with_error: boolean;
  skip_empty_lines: boolean;
  trim: boolean;
}

export interface CsvExtractorParams {
  nodeLabel: string;
  options: Partial<CsvOptions>;
  schema: Schema;
  textNodeProperties: string[];
}

export interface CsvSchemaParams {
  content: string;  // sample content
  options: Partial<CsvOptions>;
  rows: Array<Array<any>>;
  headers: number;  // header row index
  textNodeProperties: string[];
}

export interface JsonExtractorParams {
  nodeLabel: string;
  jsonSchema: Schema;
  textNodeProperties: string[];
}

export interface JsonSchemaParams {
  jsonSchema: Schema;
  textNodeProperties: string[];
}

export interface Neo4jExtractorParams {
  nodeLabel: string;
  sourceIndexName: string;
  embeddingNodeProperty: string;
  textNodeProperties: string[];
  limit: number;
}

export interface Neo4jSchemaParams {
  nodeLabel: string;
}

export interface OnesourceExtractorParams {
  nodeLabel: string;
  filepath: string;
  originalname: string;
  mimetype: string;
}

export interface TextExtractorParams {
  nodeLabel: string;
  splitter: string;
  characters: string;
  functionId: number;
  chunkSize: number;
  chunkOverlap: number;
  rephraseFunctionIds: number[];
  objectName: string;
  workspaceId: number;
  username: string;
}

export interface UnstructuredExtractorParams {
  nodeLabel: string;
  filepath: string;
  originalname: string;
  mimetype: string;
}

export type ExtractorParams =
  | CsvExtractorParams
  | JsonExtractorParams
  | Neo4jExtractorParams
  | OnesourceExtractorParams
  | TextExtractorParams
  | UnstructuredExtractorParams;

export type SchemaParams = CsvSchemaParams | JsonSchemaParams | Neo4jSchemaParams;

export interface ExtractorService {

  getChunks(extractor: string, documents: Document[] | null, params: Partial<ExtractorParams>): Promise<Chunk[]>;

  getSchema(extractor: string, params?: Partial<SchemaParams>): Promise<Schema>;

  matchDocument(extractor: string, document: ExtendedDocument): boolean;

  extract(extractor: string, filepath: string, originalname: string, mimetype: string): Promise<any>;

  getExtractors(): PluginMetadata[];

}

export interface ExtendedDocument extends Document {
  ext: string;
}

export abstract class Extractor {

  __name: string;

  protected extractorService: ExtractorService;

  constructor(extractorService: ExtractorService) {
    this.extractorService = extractorService;
  }

  static create(extractor: string, extractorService: ExtractorService) {
    return new class extends Extractor {

      async getChunks(documents: Document[] | null, params: any) {
        const chunks = await this.extractorService.getChunks(extractor, documents, params);
        return chunks.map(Chunk.create);
      }

      getSchema(params: any) {
        return this.extractorService.getSchema(extractor, params);
      }

      matchDocument(document: ExtendedDocument) {
        return this.extractorService.matchDocument(extractor, document);
      }

    }(extractorService);
  }

  abstract getChunks(documents: Document[] | null, params: Partial<ExtractorParams>): Promise<Chunk[]>;

  abstract getSchema(params?: Partial<SchemaParams>): Promise<Schema>;

  abstract matchDocument(document: ExtendedDocument): boolean;

  extract?(filepath: string, originalname: string, mimetype: string): Promise<any>;

}

export class CsvExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<CsvExtractorParams>) {
    const chunks = await this.extractorService.getChunks('csv', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Partial<CsvSchemaParams>) {
    return this.extractorService.getSchema('csv', params);
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('csv', document);
  }

}

export class JsonExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<JsonExtractorParams>) {
    const chunks = await this.extractorService.getChunks('json', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Partial<JsonSchemaParams>) {
    return this.extractorService.getSchema('json', params);
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('json', document);
  }

}

export class Neo4jExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<Neo4jExtractorParams>) {
    const chunks = await this.extractorService.getChunks('neo4j', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Neo4jSchemaParams) {
    return this.extractorService.getSchema('neo4j', params);
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('neo4j', document);
  }

}

export class OnesourceExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: OnesourceExtractorParams) {
    const chunks = await this.extractorService.getChunks('onesource', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema('onesource');
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('onesource', document);
  }

  extract(filepath: string, originalname: string, mimetype: string) {
    return this.extractorService.extract('onesource', filepath, originalname, mimetype);
  }

}

export class TextExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<TextExtractorParams>) {
    const chunks = await this.extractorService.getChunks('text', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema('text');
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('text', document);
  }

}

export class UnstructuredExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: UnstructuredExtractorParams) {
    const chunks = await this.extractorService.getChunks('unstructured', documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema('unstructured');
  }

  matchDocument(document: ExtendedDocument) {
    return this.extractorService.matchDocument('unstructured', document);
  }

  extract(filepath: string, originalname: string, mimetype: string) {
    return this.extractorService.extract('unstructured', filepath, originalname, mimetype);
  }

}
