import { JSONSchema7 } from 'json-schema';

import { Chunk } from './Chunk';
import { Document } from './Document';
import { PluginMetadata } from './common_types';

export enum ExtractorEnum {
  csv = 'csv',
  json = 'json',
  neo4j = 'neo4j',
  onesource = 'onesource',
  text = 'text',
  unstructured = 'unstructured',
}

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
  schema: JSONSchema7;
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
  jsonSchema: JSONSchema7;
  textNodeProperties: string[];
}

export interface JsonSchemaParams {
  jsonSchema: JSONSchema7;
  textNodeProperties: string[];
}

export interface Neo4jExtractorParams {
  nodeLabel: string;
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

export type ExtractorParams = CsvExtractorParams
  | JsonExtractorParams
  | Neo4jExtractorParams
  | OnesourceExtractorParams
  | UnstructuredExtractorParams;

export type SchemaParams = CsvSchemaParams | JsonSchemaParams | Neo4jSchemaParams;

export interface ExtractorService {

  getChunks(extractor: ExtractorEnum, documents: Document[] | null, params: Partial<ExtractorParams>): Promise<Chunk[]>;

  getSchema(extractor: ExtractorEnum, params?: Partial<SchemaParams>): Promise<JSONSchema7>;

  extract(extractor: ExtractorEnum, filepath: string, originalname: string, mimetype: string): Promise<any>;

  getDefaultOptions(extractor: ExtractorEnum): any;

  getExtractors(): PluginMetadata[];

}

export abstract class Extractor {

  __name: string;

  protected extractorService: ExtractorService;

  constructor(extractorService: ExtractorService) {
    this.extractorService = extractorService;
  }

  abstract getChunks(documents: Document[] | null, params: Partial<ExtractorParams>): Promise<Chunk[]>;

  abstract getSchema(params?: Partial<SchemaParams>): Promise<JSONSchema7>;

  extract?(filepath: string, originalname: string, mimetype: string): Promise<any>;

  getDefaultOptions?(): any;

}

export class CsvExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<CsvExtractorParams>) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.csv, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Partial<CsvSchemaParams>) {
    return this.extractorService.getSchema(ExtractorEnum.csv, params);
  }

  getDefaultOptions() {
    return this.extractorService.getDefaultOptions(ExtractorEnum.csv);
  }

}

export class JsonExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<JsonExtractorParams>) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.json, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Partial<JsonSchemaParams>) {
    return this.extractorService.getSchema(ExtractorEnum.json, params);
  }

}

export class Neo4jExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<Neo4jExtractorParams>) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.neo4j, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema(params: Neo4jSchemaParams) {
    return this.extractorService.getSchema(ExtractorEnum.neo4j, params);
  }

}

export class OnesourceExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: OnesourceExtractorParams) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.onesource, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema(ExtractorEnum.onesource);
  }

  extract(filepath: string, originalname: string, mimetype: string) {
    return this.extractorService.extract(ExtractorEnum.onesource, filepath, originalname, mimetype);
  }

}

export class TextExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: Partial<TextExtractorParams>) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.json, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema(ExtractorEnum.json);
  }

}

export class UnstructuredExtractor extends Extractor {

  async getChunks(documents: Document[] | null, params: UnstructuredExtractorParams) {
    const chunks = await this.extractorService.getChunks(ExtractorEnum.unstructured, documents, params);
    return chunks.map(Chunk.create);
  }

  getSchema() {
    return this.extractorService.getSchema(ExtractorEnum.unstructured);
  }

  extract(filepath: string, originalname: string, mimetype: string) {
    return this.extractorService.extract(ExtractorEnum.unstructured, filepath, originalname, mimetype);
  }

}
