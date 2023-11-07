import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatResponse,
  FunctionCall,
  Function,
  Message,
  MessageRole,
  ModelParams,
  getToolDefinitions,
} from '../core/conversions/RosettaStone';
import {
  AssistantMessage,
  FunctionMessage,
  OpenAIMessageImpl,
  UserMessage,
} from '../core/models/openai';
import * as utils from '../utils';

import { Step } from './Action_types';
import { AgentCallback } from './AgentCallback';
import {
  AgentOnEndParams,
  AgentRunParams,
} from './Agent_types';
import { AgentError } from './errors';

const PLAN_OUTPUT_PARSER = 'numberedlist';
const PROMPTSET_SKILL = 'plan';
const PROMPTSET_TEMPLATE_ENGINE = 'es6';

export default ({ logger, services }) => {

  const {
    indexesService,
    llmService,
    parserService,
    promptSetsService,
    tool,
    vectorStoreService,
  } = services;

  class PlanAndExecuteAgent {

    name: string;
    isChat: boolean;
    model: string;
    modelParams: ModelParams;
    provider: string;
    workspaceId: number;
    username: string;
    history: Message[];
    callbacks: AgentCallback[];
    currentCallbacks: AgentCallback[];
    useFunctions: boolean;

    constructor({ name, isChat, model, modelParams, provider, workspaceId, username, callbacks, useFunctions }) {
      this.name = name;
      this.isChat = isChat;
      this.model = model || 'gpt-3.5-turbo';
      this.modelParams = {
        max_tokens: 255,
        ...(modelParams || {}),
        n: 1,
      };
      this.provider = provider || 'openai';
      this.workspaceId = workspaceId;
      this.username = username;
      this.history = [];
      this.callbacks = callbacks || [];
      this.useFunctions = useFunctions;
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

      const functions = this._getFunctions(allowedTools);
      const toolDefinitions = getToolDefinitions(functions);

      // query
      const args = { content: goal, toolDefinitions };
      try {
        const plan = await this._getPlan(args);
        for (let callback of this.currentCallbacks) {
          callback.onExecutePlanStart({ plan });
        }

        // execute plan loop
        let i = 1;
        let response: ChatResponse;
        const previousSteps: Step[] = [];
        const model_params = {
          ...this.modelParams,
          stop: [
            'Observation:',
            '	Observation:',
            '\nObservation:',
          ],
        };
        for (const step of plan) {
          const content = this._getReturnContent(goal, previousSteps, step);
          const message = new UserMessage(content);
          const request = {
            model: this.model,
            model_params,
            functions,
            prompt: { history: [...this.history], messages: [message] },
          };
          // this.history.push(message);
          for (let callback of this.currentCallbacks) {
            callback.onEvaluateStepStart({
              step,
              index: i,
              request,
            });
          }
          if (this.isChat) {
            response = await llmService.createChatCompletion({
              provider: this.provider,
              request,
            });
          } else {
            response = await llmService.createCompletion({
              provider: this.provider,
              request,
            });
          }
          // this.history.push(response.choices[0].message);
          const call = response.choices[0].message.function_call;

          if (call) {
            response = await this._makeObservation(
              step,
              call,
              extraFunctionCallParams,
              this.modelParams,
              functions,
              goal,
              previousSteps,
              step,
              selfEvaluate
            );
            for (let callback of this.currentCallbacks) {
              callback.onObserveModelEnd({
                model: this.model,
                response: { ...response },
              });
            }
            // this.history.push(response.choices[0].message);
          }

          for (let callback of this.currentCallbacks) {
            callback.onEvaluateStepEnd({ model: this.model, response: { ...response } });
          }
          i += 1;
          previousSteps.push(new Step(step, response.choices[0].message.content));
        }

        for (let callback of this.currentCallbacks) {
          callback.onExecutePlanEnd({ model: this.model, response });
        }

        this._onEnd({ response });

        return response.choices[0].message.content;

      } catch (err) {
        const errors = err.errors || [{ message: String(err) }];
        this._onEnd({ errors });
        throw err;
      }
    }

    async _getPlan(args: any) {
      const messages = await this._getPlanningPrompts(args);
      const model_params = {
        ...this.modelParams,
        stop: ['<END_OF_PLAN>'],
      };
      const request = {
        model: this.model,
        model_params,
        prompt: { messages },
      };
      for (let callback of this.currentCallbacks) {
        callback.onModelStartPlan({ request });
      }
      let response: ChatResponse;
      if (this.isChat) {
        response = await llmService.createChatCompletion({
          provider: this.provider,
          request,
        });
      } else {
        response = await llmService.createCompletion({
          provider: this.provider,
          request,
        });
      }
      const content = response.choices[0].message.content;
      // this.history.push(new AssistantMessage(content));

      const plan = await this._parsePlanOutput(content);

      for (let callback of this.currentCallbacks) {
        callback.onModelEndPlan({ model: this.model, plan });
      }
      return plan;
    }

    async _getPlanningPrompts(args: any) {
      const promptSets = await promptSetsService.getPromptSetsBySkill(this.workspaceId, PROMPTSET_SKILL);
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
      const messages = this._mapMessagesToTypes(rawMessages);
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateEnd({
          messages: rawMessages,
        });
      }
      return messages;
    }

    async _parsePlanOutput(content: string) {
      const plan = await parserService.parse(PLAN_OUTPUT_PARSER, content);
      for (let callback of this.currentCallbacks) {
        callback.onParsePlan({ content, plan });
      }
      return plan;
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

    _getReturnContent(
      goal: string,
      previousSteps: Step[],
      currentStep: string,
      call?: FunctionCall,
      functionOutput?: string
    ) {
      const contents: string[] = [
        // 'Goal: ' + goal,
      ];
      if (previousSteps.length) {
        const previousStepsStr = previousSteps
          .map((step: Step, i: number) => `${i + 1}. ${step}`)
          .join('\n')
          ;
        contents.push('Previous steps:\n' + previousStepsStr);
      }
      contents.push('Current objective: ' + currentStep);
      if (call) {
        let args = JSON.parse(call.arguments);
        const action = {
          action: call.name,
          action_input: args.input,
        };
        contents.push(
          "This was your previous work (but I haven't seen any of it! I only " +
          'see what you return as final answer):\n' +
          'Action:\n' +
          '```\n' +
          JSON.stringify(action, null, 2) + '\n' +
          '```',

          'Observation: ' + functionOutput + '\n',
          'Thought:'
        );
      }
      return contents.join(PARA_DELIM);
    }

    async _makeObservation(
      step: string,
      call: FunctionCall,
      extraFunctionCallParams: any,
      modelParams: ModelParams,
      functions: Function[],
      goal: string,
      previousSteps: Step[],
      currentStep: string,
      selfEvaluate: boolean,
      retryCount: number = 0,
    ) {
      const functionOutput = await this._callFunction(call, extraFunctionCallParams);
      let content: string;
      if (this.useFunctions && this.provider === 'openai') {
        content = functionOutput;
      } else {
        content = this._getReturnContent(goal, previousSteps, currentStep, call, functionOutput);
      }
      const message = new FunctionMessage(content, call.name);
      const request = {
        model: this.model,
        model_params: this.modelParams,
        functions,
        prompt: { history: [...this.history], messages: [message] },
      };
      // this.history.push(message);
      for (let callback of this.currentCallbacks) {
        callback.onObserveModelStart({ request });
      }
      let response: ChatResponse;
      if (this.isChat) {
        response = await llmService.createChatCompletion({
          provider: this.provider,
          request,
        });
      } else {
        response = await llmService.createCompletion({
          provider: this.provider,
          request,
        });
      }

      if (selfEvaluate) {
        // validate response
        const valid = await this._evaluateResponse(step, response.choices[0].message.content);
        const retry = retryCount < 2;
        for (let callback of this.currentCallbacks) {
          callback.onEvaluateResponseEnd({ valid, retry });
        }
        if (!valid && retry) {
          response = await this._makeObservation(
            step,
            call,
            extraFunctionCallParams,
            modelParams,
            functions,
            goal,
            previousSteps,
            currentStep,
            selfEvaluate,
            retryCount + 1
          );
        }
      }

      return response;
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
        logger.debug('Error calling tool:', call.name);
        response = 'Invalid tool call';
      }
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallEnd({ response });
      }
      return response;
    }

    async _evaluateResponse(question: string, response: string) {
      const messages = [
        {
          role: MessageRole.user,
          content: `You are an oracle providing direct answers to questions. Answer the question below. Just respond with the answer or I don't know.

${response}

Question:
${question}

Answer:`
        }
      ];
      const modelParams = {
        max_tokens: 5,
        n: 1,
      };
      const request = {
        model: 'gpt-4',
        model_params: modelParams,
        prompt: { messages },
      };
      for (let callback of this.currentCallbacks) {
        callback.onEvaluateResponseStart({ question, response, request });
      }
      const res = await llmService.createChatCompletion({
        provider: 'openai',
        request,
      });
      const ans = res.choices[0].message.content;
      const valid = ans !== "I don't know";
      return valid;
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
      return messages.map((m: Message) => m.content).join(PARA_DELIM);
    }

  }

  return PlanAndExecuteAgent;

}
