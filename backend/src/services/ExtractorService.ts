import { Document } from '../core/indexers/Document';
import {
  ExtendedDocument,
  Extractor,
  ExtractorParams,
  ExtractorService,
  SchemaParams,
} from '../core/indexers/Extractor';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function ExtractorService({ logger, registry }: PluginServiceParams): ExtractorService {

  function getChunks(extractor: string, documents: Document[] | null, params: ExtractorParams) {
    logger.debug('get chunks, extractor:', extractor);
    const instance = registry[extractor] as Extractor;
    return instance.getChunks(documents, params);
  };

  function getSchema(extractor: string, params: SchemaParams) {
    logger.debug('get schema, extractor:', extractor);
    const instance = registry[extractor] as Extractor;
    return instance.getSchema(params);
  };

  function matchDocument(extractor: string, document: ExtendedDocument) {
    logger.debug('match extractor to document');
    const instance = registry[extractor] as Extractor;
    return instance.matchDocument(document);
  }

  function extract(extractor: string, filepath: string, originalname: string, mimetype: string) {
    logger.debug('extract raw, extractor:', extractor);
    const instance = registry[extractor] as Extractor;
    return instance.extract(filepath, originalname, mimetype);
  }

  function getExtractors() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getChunks,
    getSchema,
    matchDocument,
    extract,
    getExtractors,
  };

}
