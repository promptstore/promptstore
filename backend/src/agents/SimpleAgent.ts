import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatResponse,
  FunctionCall,
  ModelParams,
} from '../core/conversions/RosettaStone';

import { AgentCallback } from './AgentCallback';
import {
  AgentOnEndParams,
  AgentRunParams,
} from './Agent_types';
import { AgentError } from './errors';

export default ({ logger, services }) => {

  const {
    executionsService,
    indexesService,
    llmService,
    toolService,
    vectorStoreService,
  } = services;

  /**
   * Calls semantic function or composition
   */
  class SimpleAgent {

    name: string;
    model: string;
    modelParams: Partial<ModelParams>;
    provider: string;
    isChat: boolean;
    workspaceId: number;
    username: string;
    callbacks: AgentCallback[];
    currentCallbacks: AgentCallback[];
    useFunctions: boolean;
    semanticFunctions: any[];
    compositions: any[];
    subAgents: any[];
    parentAgentName: string;

    constructor({
      isChat = false,
      model,
      modelParams,
      name,
      provider,
      workspaceId,
      username,
      callbacks,
      useFunctions = false,
      semanticFunctions,
      compositions,
      subAgents,
    }) {
      this.name = name;
      this.isChat = isChat;
      this.model = model || (isChat ? 'gpt-3.5-turbo-0613' : 'text-davinci-003');
      this.modelParams = {
        max_tokens: 1024,
        ...(modelParams || {}),
        n: 1,
      };
      this.provider = provider || 'openai';
      this.workspaceId = workspaceId;
      this.username = username;
      this.callbacks = callbacks || [];
      this.useFunctions = useFunctions;
      this.semanticFunctions = semanticFunctions;
      this.compositions = compositions;
      this.subAgents = subAgents;
    }

    async run({ args, allowedTools = [], extraFunctionCallParams, selfEvaluate, callbacks = [], parentAgentName }: AgentRunParams) {
      this.currentCallbacks = [...this.callbacks, ...callbacks];
      this.parentAgentName = parentAgentName;
      for (let callback of this.currentCallbacks) {
        callback.onAgentStart({
          name: this.name,
          args,
          allowedTools,
          extraFunctionCallParams,
          selfEvaluate,
          parent: this.parentAgentName,
        });
      }

      let functions: FunctionCall[];
      if (this.useFunctions) {
        functions = this._getFunctions(allowedTools);
      }
      args = {
        content: args.goal,
        agent_scratchpad: '',  // TODO variables should be optional by default

        // deprecated - using universal model calling instead
        tools: toolService.getToolsList(allowedTools),
        tool_names: toolService.getToolNames(allowedTools),
      };
      try {
        let call: FunctionCall;
        let content: string;
        let response: any;
        if (this.semanticFunctions?.length) {
          const func = this.semanticFunctions[0];
          const res = await executionsService.executeFunction({
            workspaceId: this.workspaceId,
            username: this.username,
            func,
            args,
            functions,
            params: { maxTokens: 1024 },
          });
          response = res.response;
          const message = response.choices[0].message;
          if (message.function_call) {
            call = message.function_call;
          } else {
            content = message.content as string;
          }
        } else if (this.compositions?.length) {
          const composition = this.compositions[0];
          const res = await executionsService.executeComposition({
            workspaceId: this.workspaceId,
            username: this.username,
            composition,
            args,
            functions,
            params: { maxTokens: 1024 },
          });
          content = res.response.myargs.content;

          // TODO standardize semfunc and composition responses?
          response = { choices: [{ message: { content } }] };

        }
        if (call) {
          content = await this._callFunction(call, extraFunctionCallParams)
        } else if (content) {
          for (let callback of this.currentCallbacks) {
            callback.onObserveModelEnd({
              response,
              parent: this.parentAgentName,
              name: this.name,
            });
          }
        }

        this._onEnd({ response: content });

        return content;

      } catch (err) {
        const errors = err.errors || [{ message: String(err) }];
        this._onEnd({ errors });
        throw err;
      }
    }

    _getFunctions(allowedTools: string[]) {
      let functions = toolService.getAllMetadata(allowedTools);
      if (allowedTools.includes('searchIndex')) {
        functions.push({
          id: uuid.v4(),
          name: 'searchIndex',
          description: 'a search engine. useful for when you need to answer questions about current events. input should be a search query.',
          parameters: {
            properties: {
              input: {
                description: 'Input text',
                type: 'string',
              },
            },
            required: ['input'],
            type: 'object',
          },
        });
      }
      if (functions.length === 0) {
        functions = undefined;
      }
      return functions;
    }

    async _callFunction(call: FunctionCall, extraFunctionCallParams: any) {
      logger.debug('call:', call, this.subAgents);
      const { email, indexName } = extraFunctionCallParams;
      let args: any;
      try {
        args = JSON.parse(call.arguments);
      } catch (err) {
        logger.error('Error parsing call arguments:', String(err), call.arguments);
        return "I don't know how to answer that";
      }
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallStart({
          name: this.name,
          call,
          args,
          parent: this.parentAgentName,
        });
      }
      let response: any;
      try {
        if (call.name === 'searchIndex') {
          const index = await indexesService.getIndexByName(indexName);
          if (!index) {
            throw new Error('Index not found: ' + indexName);
          }
          const { embeddingProvider, embeddingModel, vectorStoreProvider } = index;
          if (!vectorStoreProvider) {
            throw new Error('Only vector stores currently support search');
          }
          let queryEmbedding: number[];
          if (vectorStoreProvider !== 'redis' && vectorStoreProvider !== 'elasticsearch') {
            const embeddingResponse = await llmService.createEmbedding(embeddingProvider, {
              ...args,
              inputType: 'search_query',
              model: embeddingModel,
            });
            queryEmbedding = embeddingResponse.data[0].embedding;
          }
          const searchResponse = await vectorStoreService.search(
            vectorStoreProvider,
            indexName,
            args.input,
            null,
            null,
            { k: 5, queryEmbedding }
          );
          response = searchResponse.hits.join(PARA_DELIM);
        } else {
          if (call.name === 'email') {
            args.name = this.name;
            args.email = email;
          }
          response = await toolService.call(call.name, args, false);
        }
      } catch (err) {
        console.log('Error calling tool:', call.name, err.message, err.stack);
        response = 'Invalid tool call';
      }
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallEnd({
          name: this.name,
          response,
          parent: this.parentAgentName,
        });
      }
      return response;
    }

    _onEnd({ response, errors }: AgentOnEndParams) {
      for (let callback of this.currentCallbacks) {
        callback.onAgentEnd({
          name: this.name,
          response,
          errors,
          parent: this.parentAgentName,
        });
      }
    }

    _throwAgentError(message: string) {
      const errors = [{ message }];
      for (let callback of this.currentCallbacks) {
        callback.onAgentError(errors);
      }
      throw new AgentError(message);
    }

  }

  return SimpleAgent;

}
