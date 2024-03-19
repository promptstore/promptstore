import { PluginServiceParams } from '../core/indexers/Plugin';
import { Parser, ParserService } from '../core/outputprocessing/OutputProcessingPipeline_types';

export function ParserService({ registry, logger }: PluginServiceParams): ParserService {

  async function parse(provider: string, text: string) {
    const instance = registry[provider] as Parser;
    return await instance.parse(text);
  }

  function getOutputParsers() {
    return Object.entries(registry)
      .map(([key, p]) => ({
        key,
        name: p.__name,
      }));
  }

  return {
    getOutputParsers,
    parse,
  };

}
