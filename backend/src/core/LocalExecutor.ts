import logger from '../logger';

import { ModelParams } from './Model_types';
import { IMessage } from './PromptTemplate_types';
import { SemanticFunction } from './SemanticFunction';

interface RunFunctionParams {
  semanticFunction: SemanticFunction;
  args: any;
  history?: IMessage[];
  modelKey: string;
  modelParams: ModelParams;
  isBatch: boolean;
  workspaceId: number;
  username: string;
}

export class LocalExecutor {

  async runFunction({
    semanticFunction,
    args,
    history,
    modelKey,
    modelParams,
    isBatch,
  }: RunFunctionParams) {
    logger.info('execute function', semanticFunction.name);
    if (!isBatch) logger.debug('args:', args);
    logger.debug('model:', modelKey, modelParams);
    modelParams = this.fixModelParams(modelParams);
    if (history) {
      history = this.fixMessages(history);
    }

    return semanticFunction.call({ args, history, modelKey, modelParams, isBatch });
  }

  async runComposition({
    composition,
    args,
    modelKey,
    modelParams,
    isBatch,
  }) {
    logger.info('execute composition', composition.name);
    if (!isBatch) logger.debug('args:', args);
    logger.debug('model:', modelKey, modelParams);
    modelParams = this.fixModelParams(modelParams);

    return composition.call({ args, modelKey, modelParams, isBatch });
  }

  fixMessages(messages: IMessage[]) {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  fixModelParams(modelParams: ModelParams) {
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
