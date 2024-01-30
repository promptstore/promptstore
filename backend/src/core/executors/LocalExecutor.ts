import logger from '../../logger';

import { Function, Message, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

interface RunFunctionParams {
  semanticFunction: SemanticFunction;
  args: any;
  messages?: Message[];
  history?: Message[];
  extraSystemPrompt?: string;
  modelKey: string;
  modelParams: Partial<ModelParams>;
  functions?: Function[];
  isBatch: boolean;
  options?: any;
  workspaceId: number;
  username: string;
}

export class LocalExecutor {

  async runFunction({
    semanticFunction,
    args,
    messages,
    history,
    extraSystemPrompt,
    modelKey,
    modelParams,
    functions,
    isBatch,
    options,
  }: RunFunctionParams) {
    logger.info('execute function', semanticFunction.name);
    if (!isBatch) logger.debug('args:', args);
    logger.debug('model:', modelKey, modelParams);
    modelParams = this.fixModelParams(modelParams);
    if (history) {
      history = this.fixMessages(history);
    }

    return semanticFunction.call({ args, messages, history, extraSystemPrompt, modelKey, modelParams, functions, isBatch, options });
  }

  async runComposition({
    composition,
    args,
    modelKey,
    modelParams,
    isBatch,
  }) {
    logger.info('execute composition:', composition.name);
    if (!isBatch) logger.debug('args:', args);
    logger.debug('model:', modelKey, modelParams);
    modelParams = this.fixModelParams(modelParams);

    return composition.call({ args, modelKey, modelParams, isBatch });
  }

  fixMessages(messages: Message[]) {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  fixModelParams(modelParams: Partial<ModelParams>) {
    return {
      ...modelParams,
      max_tokens: this.fixNumber(modelParams.max_tokens, 140),
      n: this.fixNumber(modelParams.n, 1),
    };
  }

  fixNumber(value: any, defaultValue: number = 0) {
    const num = +value;
    return isNaN(num) ? defaultValue : num;
  }

}
