import {
  Loader,
  LoaderEnum,
  LoaderParams,
  LoaderService,
} from '../core/indexers/Loader';
import { PluginServiceParams } from '../core/indexers/Plugin';

export function LoaderService({ logger, registry }: PluginServiceParams): LoaderService {

  function load(loader: LoaderEnum, params: LoaderParams) {
    logger.debug('load from loader:', loader);
    const instance = registry[loader] as Loader;
    return instance.load(params);
  };

  function getLoaders() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    load,
    getLoaders,
  };

}
