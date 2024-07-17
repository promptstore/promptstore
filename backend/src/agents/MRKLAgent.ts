import trim from 'lodash.trim';
import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatRequest,
  ChatResponse,
  FunctionCall,
  Message,
  ModelParams,
} from '../core/conversions/RosettaStone';
import {
  AssistantMessage,
  FunctionMessage,
  OpenAIMessageImpl,
  UserMessage,
} from '../core/models/openai';
import * as utils from '../utils';

import { AgentAction, AgentFinish } from './Action_types';
import { AgentCallback } from './AgentCallback';
import {
  AgentOnEndParams,
  AgentRunParams,
} from './Agent_types';
import { AgentError, OutputParserException } from './errors';

const FINAL_ANSWER_ACTION = 'Final Answer:';
const PROMPTSET_TEMPLATE_ENGINE = 'handlebars';
const STOP = [
  'Observation:',
  '	Observation:'
];

export default ({ logger, services }) => {

  const {
    executionsService,
    indexesService,
    llmService,
    promptSetsService,
    toolService,
    vectorStoreService,
  } = services;

  /**
   * Modular Reasoning, Knowledge and Language (MRKL)
   * https://arxiv.org/abs/2205.00445
   * 
   * An implementation of the MRKL paper using ReAct (Reason + Action)
   */
  class MRKLAgent {

    name: string;
    model: string;
    modelParams: Partial<ModelParams>;
    provider: string;
    isChat: boolean;
    maxIterations: number;
    maxExecutionTime: number;
    workspaceId: number;
    username: string;
    history: Message[];
    callbacks: AgentCallback[];
    currentCallbacks: AgentCallback[];
    useFunctions: boolean;
    promptSetSkill: string;
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
        stop: STOP,
      };
      this.provider = provider || 'openai';
      this.workspaceId = workspaceId;
      this.username = username;
      this.history = [];
      this.callbacks = callbacks || [];
      this.maxIterations = 6;
      this.maxExecutionTime = 30000;
      this.useFunctions = useFunctions;
      this.semanticFunctions = semanticFunctions;
      this.compositions = compositions;
      this.subAgents = subAgents;

      // TODO
      this.promptSetSkill = useFunctions ? 'react_plan_1' : 'react_plan';
    }

    reset() {
      this.history = [];
    }

    async run({ args, allowedTools, extraFunctionCallParams, selfEvaluate, callbacks = [], parentAgentName }: AgentRunParams) {
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

      let iterations = 0;
      let elapsedTime = 0.0;

      const functions = this._getFunctions(allowedTools);
      args = {
        content: args.goal,
        agent_scratchpad: '',  // TODO variables should be optional by default

        // deprecated - using universal model calling instead
        tools: toolService.getToolsList(allowedTools),
        tool_names: toolService.getToolNames(allowedTools),
      };
      try {
        let messages = await this._getSetupPrompts(args);

        // enter the agent loop
        while (this._shouldContinue(iterations, elapsedTime)) {
          const request: ChatRequest = {
            model: this.model,
            model_params: this.modelParams,
            prompt: {
              history: [...this.history],
              messages: [...messages],
            },
          };
          this.history.push(...messages);

          if (this.useFunctions) {
            request.functions = functions;
          }

          for (let callback of this.currentCallbacks) {
            callback.onEvaluateTurnStart({
              name: this.name,
              index: iterations,
              request,
            });
          }
          const { done, content, name } = await this._next(request, extraFunctionCallParams);
          for (let callback of this.currentCallbacks) {
            callback.onEvaluateTurnEnd({
              model: this.model,
              done,
              content,
            });
          }
          if (done) {
            this._onEnd({ response: content });
            logger.debug('Return agent response:', content);
            return content;
          }
          let message: Message;
          if (this.useFunctions && name) {
            message = new FunctionMessage(content, name);
          } else {
            message = new UserMessage(content);
          }
          messages = [message];
          iterations += 1;
        }
        return 'Done';

      } catch (err) {
        const errors = err.errors || [{ message: String(err) }];
        this._onEnd({ errors });
        throw err;
      }
    }

    async _getSetupPrompts(args: any) {
      const promptSets = await promptSetsService.getPromptSetsBySkill(this.workspaceId, this.promptSetSkill);
      if (!promptSets.length) {
        this._throwAgentError('Prompt not found');
      }
      const { id, name, prompts } = promptSets[0];
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateStart({
          promptSetId: id,
          promptSetName: name,
          messageTemplates: prompts,
          args,
          isBatch: false,
        });
      }
      const rawMessages = utils.getMessages(prompts, args, PROMPTSET_TEMPLATE_ENGINE);
      let messages = this._mapMessagesToTypes(rawMessages);
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateEnd({
          messages: rawMessages,
        });
      }
      return messages;
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
      if (this.subAgents?.length) {
        for (const agent of this.subAgents) {
          functions.push({
            id: uuid.v4(),
            name: agent.name,
            description: agent.description,
            parameters: {
              type: 'object',
              properties: {
                goal: {
                  type: 'string',
                  description: 'The goal that the agent is tasked to achieve.'
                }
              }
            },
          });
        }
      }
      if (this.semanticFunctions?.length) {
        for (const fn of this.semanticFunctions) {
          functions.push({
            id: uuid.v4(),
            name: fn.name,
            description: fn.description,
            parameters: fn.arguments,
          });
        }
      }
      if (this.compositions?.length) {
        for (const comp of this.compositions) {
          const requestNode = comp.flow.nodes?.find((n: any) => n.type === 'requestNode');
          if (requestNode) {
            functions.push({
              id: uuid.v4(),
              name: comp.name,
              description: comp.description,
              parameters: requestNode.data.arguments,
            });
          }
        }
      }
      if (functions.length === 0) {
        functions = undefined;
      }
      return functions;
    }

    _shouldContinue(iterations: number, elapsedTime: number) {
      if (iterations >= this.maxIterations) {
        return false;
      }
      if (elapsedTime >= this.maxExecutionTime) {
        return false;
      }
      return true;
    }

    async _next(request: ChatRequest, extraFunctionCallParams: any) {
      for (let callback of this.currentCallbacks) {
        callback.onObserveModelStart({ provider: this.provider, request });
      }
      let response: ChatResponse;
      if (this.isChat) {
        response = await llmService.createChatCompletion(this.provider, request);
      } else {
        response = await llmService.createCompletion(this.provider, request);
      }
      for (let callback of this.currentCallbacks) {
        callback.onObserveModelEnd({
          response: { ...response },
          parent: this.parentAgentName,
          name: this.name,
        });
      }

      const { content, final, function_call: call, } = response.choices[0].message;
      if (this.useFunctions) {
        if (call) {
          const functionOutput = await this._callFunction(call, extraFunctionCallParams);
          return {
            done: false,
            content: this._makeObservation(functionOutput),
            name: call.name,
          };
        }

        // TODO
        // standardise response format with 'Plan & Execute' Agent,
        // which returns JSON
        if (final || (content as string).includes('Final Answer:')) {
          const mycontent = (content as string).split('Final Answer:')[1].trim();
          return { done: true, content: mycontent };
        }

        this.history.push(new AssistantMessage(content as string));
        return { done: false, content: this._makeObservation(content as string) };
        // const { error, retriable } = this._getParseError(content as string);
        // if (retriable) {
        //   return { done: false, content: this._makeObservation(error) };
        // }
        // this._throwAgentError(error);
      }

      this.history.push(new AssistantMessage(content as string));
      return this._processResponse(content as string, extraFunctionCallParams);
    }

    async _processResponse(content: string, extraFunctionCallParams: any) {
      try {
        const action = this._parseResponse(content);
        if (action instanceof AgentAction) {
          const args = action.toolInput;
          const call = {
            name: action.action,
            arguments: args,
          };
          const functionOutput = await this._callFunction(call, extraFunctionCallParams);
          return {
            done: false,
            content: this._makeObservation(functionOutput),
            name: action.action,
          };
        }
        if (action instanceof AgentFinish) {
          return {
            done: true,
            content: action.returnValues.output,
          };
        }
      } catch (err) {
        let message = err.message;
        if (err.stack) {
          message += '\n' + err.stack;
        }
        logger.error(message);
        if (err instanceof OutputParserException) {
          const { sendToLLM, observation } = err.options;
          if (sendToLLM) {
            return { done: false, content: observation };
          }
        }
        this._throwAgentError(message);
      }
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
      let agent: any;
      let composition: any;
      let func: any;
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
        } else if (func = (this.semanticFunctions || []).find(f => f.name === call.name)) {
          const functionResponse = await executionsService.executeFunction({
            workspaceId: this.workspaceId,
            username: this.username,
            func,
            args,
            params: { maxTokens: 1024 },
          });
          const message = functionResponse.response.choices[0].message;
          if (message.function_call) {
            response = message.function_call.arguments;
          } else {
            response = message.content;
          }
        } else if (composition = (this.compositions || []).find(c => c.name === call.name)) {
          const compositionResponse = await executionsService.executeComposition({
            workspaceId: this.workspaceId,
            username: this.username,
            composition,
            args,
            params: { maxTokens: 1024 },
          });
          const content = compositionResponse.response.myargs.content;
          response = { choices: [{ message: { content } }] };
        } else if (agent = (this.subAgents || []).find(a => a.name === call.name)) {
          let parent = this.name;
          if (this.parentAgentName) {
            parent = this.parentAgentName + ' - ' + parent;
          }
          const agentResponse = await executionsService.executeAgent({
            workspaceId: this.workspaceId,
            username: this.username,
            agent,
            args,
            callbacks: this.currentCallbacks,
            parentAgentName: parent,
          });
          logger.debug('agentResponse:', agentResponse);
          response = agentResponse;
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

    _parseResponse(content: string) {
      const hasFinalAnswer = content.includes(FINAL_ANSWER_ACTION);
      logger.debug('hasFinalAnswer:', hasFinalAnswer);
      const actionRegex = new RegExp(
        /Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/,
        's'
      );
      const actionMatch = content.match(actionRegex);
      logger.debug('_parseResponse actionMatch:', actionMatch);
      if (actionMatch) {
        const action = actionMatch[1];
        if (hasFinalAnswer) {
          const observation =
            `Parsing LLM output produced both a final answer and a parseable ` +
            `action: ${action}`;
          throw new OutputParserException(
            `Could not parse LLM output: "${content}"`,
            {
              observation,
              llmOutput: content,
              sendToLLM: true,
            }
          );
        }
        const actionInput = actionMatch[2];
        let input = actionInput.trim();

        // if it's a SQL query don't remove trailing quotes
        if (!input.startsWith('SELECT ')) {
          input = trim(input, '"');
        }
        logger.debug('input:', input);

        return new AgentAction(action, input, content);

      } else if (hasFinalAnswer) {
        const output = content.split(FINAL_ANSWER_ACTION)[1].trim();
        logger.debug('output:', output);
        const returnValues = { output };
        return new AgentFinish(returnValues, content);
      }

      const { error, retriable } = this._getParseError(content);
      throw new OutputParserException(
        `Could not parse LLM output: "${content}"`,
        {
          observation: error,
          llmOutput: content,
          sendToLLM: retriable,
        }
      );
    }

    _getParseError(content: string) {
      // determine parser exception and whether to try again
      const re1 = new RegExp(/Action\s*\d*\s*:[\s]*(.*?)/, 's');
      const re2 = new RegExp(/[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/, 's');
      const match1 = content.match(re1);
      const match2 = content.match(re2);
      if (!match1) {
        return {
          error: 'Invalid Format: Missing "Action:" after "Thought:"',
          retriable: true,
        };
      }
      if (!match2) {
        return {
          error: 'Invalid Format: Missing "Action Input:" after "Thought:"',
          retriable: true,
        };
      }
      return {
        error: `Could not parse LLM output: "${content}"`,
      };
    }

    _makeObservation(observation: string) {
      return 'Observation: ' + observation + '\nThought:';
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

    _mapMessagesToTypes(rawMessages: any) {
      return rawMessages.map((m: any) => new OpenAIMessageImpl(m));
    }

    _printMessages(messages: Message[]) {
      return messages
        .filter((m: Message) => m.role !== 'system')
        .map((m: Message) => m.content)
        .join(PARA_DELIM)
        ;
    }

  }

  return MRKLAgent;

}
