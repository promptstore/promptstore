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
    indexesService,
    llmService,
    promptSetsService,
    tool,
    vectorStoreService,
  } = services;

  class SimpleAgent {

    name: string;
    model: string;
    modelParams: ModelParams;
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
    }) {
      this.name = name;
      this.isChat = isChat;
      this.model = model || (isChat ? 'gpt-4-1106-preview' : 'text-davinci-003');
      this.modelParams = {
        max_tokens: 255,
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

      // TODO
      this.promptSetSkill = useFunctions ? 'simple_agent' : 'simple_agent';
    }

    reset() {
      this.history = [];
    }

    async run({ goal, allowedTools, extraFunctionCallParams, selfEvaluate, callbacks = [] }: AgentRunParams) {
      this.currentCallbacks = [...this.callbacks, ...callbacks];
      for (let callback of this.currentCallbacks) {
        callback.onAgentStart({
          agentName: this.name,
          goal,
          allowedTools,
          extraFunctionCallParams,
          selfEvaluate,
        });
      }

      let iterations = 0;
      let elapsedTime = 0.0;

      const functions = this._getFunctions(allowedTools);
      const args = {
        content: goal,
        agent_scratchpad: '',  // TODO variables should be optional by default

        // deprecated - using universal model calling instead
        tools: tool.getToolsList(allowedTools),
        tool_names: tool.getToolNames(allowedTools),
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

          if (this.useFunctions) {
            request.functions = functions;
          }

          for (let callback of this.currentCallbacks) {
            callback.onEvaluateTurnStart({
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
            return content;
          }
          this.history.push(...messages);
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
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateStart({
          messageTemplates: promptSets[0].prompts,
          args,
        });
      }
      const rawMessages = utils.getMessages(promptSets[0].prompts, args, PROMPTSET_TEMPLATE_ENGINE);
      let messages = this._mapMessagesToTypes(rawMessages);
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateEnd({
          messages: rawMessages,
        });
      }
      return messages;
    }

    _getFunctions(allowedTools: string[]) {
      let functions = tool.getAllMetadata(allowedTools);
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
        callback.onObserveModelStart({ request });
      }
      let response: ChatResponse;
      if (this.isChat) {
        response = await llmService.createChatCompletion({ provider: this.provider, request });
      } else {
        response = await llmService.createCompletion({ provider: this.provider, request });
      }
      for (let callback of this.currentCallbacks) {
        callback.onObserveModelEnd({
          model: this.model,
          response: { ...response },
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
        if (final) {
          return { done: true, content };
        }
        const { error, retriable } = this._getParseError(content);
        if (retriable) {
          return { done: false, content: this._makeObservation(error) };
        }
        this._throwAgentError(error);
      }

      return this._processResponse(content, extraFunctionCallParams);
    }

    async _processResponse(content: string, extraFunctionCallParams: any) {
      try {
        const action = this._parseResponse(content);
        if (action instanceof AgentAction) {
          const args = { input: action.toolInput };
          const call = {
            name: action.action,
            arguments: JSON.stringify(args),
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
        logger.error(err);
        if (err instanceof OutputParserException) {
          const { sendToLLM, observation } = err.options;
          if (sendToLLM) {
            return { done: false, content: observation };
          }
        }
        this._throwAgentError(err.message);
      }
    }

    async _callFunction(call: FunctionCall, extraFunctionCallParams: any) {
      const { email, indexName } = extraFunctionCallParams;
      let args = JSON.parse(call.arguments);
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallStart({ call, args });
      }
      let response: any;
      try {
        if (call.name === 'searchIndex') {
          const index = await indexesService.getIndexByName(indexName);
          if (!index) {
            throw new Error('Index not found: ' + indexName);
          }
          if (!index.vectorStoreProvider) {
            throw new Error('Only vector stores currently support search');
          }
          const searchResponse = await vectorStoreService.search(index.vectorStoreProvider, indexName, args.input);
          response = searchResponse.hits.join(PARA_DELIM);
        } else {
          if (call.name === 'email') {
            args.agentName = this.name;
            args.email = email;
          }
          response = await tool.call(call.name, args);
        }
      } catch (err) {
        console.log('Error calling tool:', call.name);
        response = 'Invalid tool call';
      }
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallEnd({ response });
      }
      return response;
    }

    _parseResponse(content: string) {
      const hasFinalAnswer = content.includes(FINAL_ANSWER_ACTION);
      const actionRegex = new RegExp(
        /Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/,
        'gs'
      );
      const actionMatch = content.match(actionRegex);
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

        return new AgentAction(action, input, content);

      } else if (hasFinalAnswer) {
        const output = content.split(FINAL_ANSWER_ACTION)[1].trim();
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
      const re1 = new RegExp(/Action\s*\d*\s*:[\s]*(.*?)/, 'gs');
      const re2 = new RegExp(/[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/, 'gs');
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
          agentName: this.name,
          response,
          errors,
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

  return SimpleAgent;

}
