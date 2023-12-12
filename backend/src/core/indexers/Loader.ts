import { Document } from './Document';
import { PluginMetadata } from './common_types';

export interface ApiLoaderParams {
  endpoint: string;
  schema: object;
}

export interface MinioLoaderParams {
  objectName: string;
  maxBytes?: number;
}

export interface WikipediaLoaderParams {
  query: string;
}

export type LoaderParams = ApiLoaderParams | MinioLoaderParams | WikipediaLoaderParams;

export interface LoaderService {

  load(loader: string, params: LoaderParams): Promise<Document[]>;

  getLoaders(): PluginMetadata[];

}

export abstract class Loader {

  __name: string;

  protected loaderService: LoaderService;

  constructor(loaderService: LoaderService) {
    this.loaderService = loaderService;
  }

  static create(loader: string, loaderService: LoaderService) {
    return new class extends Loader {

      async load(params: any) {
        const docs = await this.loaderService.load(loader, params);
        return docs.map(Document.create);
      }

    }(loaderService);
  }

  abstract load(params: LoaderParams): Promise<Document[]>;

}

export class ApiLoader extends Loader {

  async load(params: ApiLoaderParams) {
    const docs = await this.loaderService.load('api', params);
    return docs.map(Document.create);
  }

}

export class MinioLoader extends Loader {

  async load(params: MinioLoaderParams) {
    const docs = await this.loaderService.load('minio', params);
    return docs.map(Document.create);
  }

}

export class WikipediaLoader extends Loader {

  async load(params: WikipediaLoaderParams) {
    const docs = await this.loaderService.load('wikipedia', params);
    return docs.map(Document.create);
  }

}
