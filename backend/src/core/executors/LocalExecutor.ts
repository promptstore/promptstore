import logger from '../../logger';

import { Function, Message, ModelObject, ModelParams } from '../conversions/RosettaStone';
import { SemanticFunction } from '../semanticfunctions/SemanticFunction';

interface RunFunctionParams {
  semanticFunction: SemanticFunction;
  args: any;
  env?: string;
  messages?: Message[];
  history?: Message[];
  extraSystemPrompt?: string;
  model: ModelObject;
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
    env,
    messages,
    history,
    extraSystemPrompt,
    model,
    modelParams,
    functions,
    isBatch,
    options,
  }: RunFunctionParams) {
    logger.info('execute function', semanticFunction.name);
    if (!isBatch) logger.debug('args:', args);
    if (model) {
      logger.debug('model: [provider=%s; key=%s]', model.provider, model.model);
    }
    modelParams = this.fixModelParams(modelParams);
    logger.debug('model params:', modelParams);
    if (history) {
      history = this.fixMessages(history);
    }

    return semanticFunction.call({ args, env, messages, history, extraSystemPrompt, model, modelParams, functions, isBatch, options });
  }

  async runComposition({
    composition,
    args,
    model,
    modelParams,
    functions,
    isBatch,
  }) {
    logger.info('execute composition:', composition.name);
    if (!isBatch) logger.debug('args:', args);
    if (model) {
      logger.debug('model: [provider=%s; key=%s]', model.provider, model.key);
    }
    modelParams = this.fixModelParams(modelParams);
    logger.debug('model params:', modelParams);

    return composition.call({ args, model, modelParams, functions, isBatch });
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
      max_tokens: this.fixNumber(modelParams.max_tokens, 2048),
      n: this.fixNumber(modelParams.n, 1),
    };
  }

  fixNumber(value: any, defaultValue: number = 0) {
    const num = +value;
    return isNaN(num) ? defaultValue : num;
  }

}
