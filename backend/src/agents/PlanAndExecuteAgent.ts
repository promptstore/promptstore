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
  Agent,
  AgentOnEndParams,
  AgentRunParams,
} from './Agent_types';
import { AgentError } from './errors';

const PLAN_OUTPUT_PARSER = 'numberedlist';
const PROMPTSET_SKILL = 'plan';
const PROMPTSET_TEMPLATE_ENGINE = 'es6';

export default ({ logger, services }) => {

  const {
    executionsService,
    indexesService,
    llmService,
    parserService,
    promptSetsService,
    toolService,
    vectorStoreService,
  } = services;

  class PlanAndExecuteAgent implements Agent {

    name: string;
    isChat: boolean;
    model: string;
    modelParams: Partial<ModelParams>;
    provider: string;
    workspaceId: number;
    username: string;
    history: Message[];
    callbacks: AgentCallback[];
    currentCallbacks: AgentCallback[];
    useFunctions: boolean;
    semanticFunctions: any[];
    compositions: any[];
    subAgents: any[];

    constructor({
      name,
      isChat = false,
      model,
      modelParams,
      provider,
      workspaceId,
      username,
      callbacks,
      useFunctions,
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
      this.history = [];
      this.callbacks = callbacks || [];
      this.useFunctions = useFunctions;
      this.semanticFunctions = semanticFunctions;
      this.compositions = compositions;
      this.subAgents = subAgents;
    }

    reset() {
      this.history = [];
    }

    async run({ args, allowedTools, extraFunctionCallParams, selfEvaluate, callbacks = [] }: AgentRunParams) {
      this.currentCallbacks = [...this.callbacks, ...callbacks];
      for (let callback of this.currentCallbacks) {
        callback.onAgentStart({
          name: this.name,
          args,
          allowedTools,
          extraFunctionCallParams,
          selfEvaluate,
        });
      }

      const functions = this._getFunctions(allowedTools);
      const toolDefinitions = getToolDefinitions(functions);

      logger.debug('toolDefinitions:', toolDefinitions)

      // query
      args = { content: args.goal, toolDefinitions };
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
          const content = this._getReturnContent(args.goal, previousSteps, step);
          console.log('\n!!!!! STEP:\n', step, '\n', content, '\n!!!!!\n');
          const message = new UserMessage(content);
          const request = {
            model: this.model,
            model_params,
            functions,
            prompt: { history: [...this.history], messages: [message] },
          };
          this._pushMessage(message);
          for (let callback of this.currentCallbacks) {
            callback.onEvaluateStepStart({
              step,
              index: i,
              request,
            });
          }
          if (this.isChat) {
            response = await llmService.createChatCompletion(this.provider, request);
            console.log('\n!!!!! NEXT STEP RESPONSE:\n', JSON.stringify(response.choices[0].message, null, 2), '\n!!!!!\n');
          } else {
            response = await llmService.createCompletion({
              provider: this.provider,
              request,
            });
          }
          // this._pushMessage(response.choices[0].message);
          const call = response.choices[0].message.function_call;

          if (call) {
            console.log('\n!!!!! IS_CALL\n!!!!!\n');
            response = await this._makeObservation(
              step,
              call,
              extraFunctionCallParams,
              this.modelParams,
              functions,
              args.goal,
              previousSteps,
              step,
              selfEvaluate
            );
            // console.log('\n!!!!! OBSERVATION:\n', JSON.stringify(response.choices[0].message, null, 2), '\n!!!!!\n');
            // for (let callback of this.currentCallbacks) {
            //   callback.onObserveModelEnd({
            //     model: this.model,
            //     response: { ...response },
            //   });
            // }
            // this._pushMessage(response.choices[0].message);
          }

          for (let callback of this.currentCallbacks) {
            callback.onEvaluateStepEnd({ response: { ...response } });
          }
          i += 1;
          previousSteps.push(new Step(step, response.choices[0].message.content as string));
        }

        for (let callback of this.currentCallbacks) {
          callback.onExecutePlanEnd({ response });
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
        callback.onModelStartPlan({ provider: this.provider, request });
      }
      let response: ChatResponse;
      if (this.isChat) {
        response = await llmService.createChatCompletion(this.provider, request);
      } else {
        response = await llmService.createCompletion({
          provider: this.provider,
          request,
        });
      }
      const content = response.choices[0].message.content as string;
      this._pushMessage(new AssistantMessage(content));

      const plan = await this._parsePlanOutput(content);

      for (let callback of this.currentCallbacks) {
        callback.onModelEndPlan({ model: this.model, plan });
      }
      return plan;
    }

    _pushMessage(message: Message) {
      logger.debug('Push message:', message);
      this.history.push(message);
    }

    async _getPlanningPrompts(args: any) {
      const promptSets = await promptSetsService.getPromptSetsBySkill(this.workspaceId, PROMPTSET_SKILL);
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
      const messages = this._mapMessagesToTypes(rawMessages);
      for (let callback of this.currentCallbacks) {
        callback.onPromptTemplateEnd({
          messages: rawMessages,
        });
      }
      return messages;
    }

    async _parsePlanOutput(content: string) {
      const { json } = await parserService.parse(PLAN_OUTPUT_PARSER, content);
      for (let callback of this.currentCallbacks) {
        callback.onParsePlan({ content, plan: json });
      }
      return json;
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
      modelParams: Partial<ModelParams>,
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
      this._pushMessage(message);

      // TODO why do I need another call to comment on the tool result

      // const request = {
      //   model: this.model,
      //   model_params: this.modelParams,
      //   functions,
      //   prompt: { history: [...this.history], messages: [message] },
      // };
      // console.log('\n!!!!! OBSERVATION REQUEST:\n', JSON.stringify(request, null, 2), '\n!!!!!\n');

      // for (let callback of this.currentCallbacks) {
      //   callback.onObserveModelStart({ request });
      // }
      // let response: ChatResponse;
      // if (this.isChat) {
      //   response = await llmService.createChatCompletion(this.provider, request);
      //   console.log('\n!!!!! OBSERVATION RESPONSE:\n', JSON.stringify(response.choices[0].message, null, 2), '\n!!!!!\n');
      // } else {
      //   response = await llmService.createCompletion({
      //     provider: this.provider,
      //     request,
      //   });
      // }

      // if (selfEvaluate) {
      //   // validate response
      //   const valid = await this._evaluateResponse(step, response.choices[0].message.content);
      //   const retry = retryCount < 2;
      //   for (let callback of this.currentCallbacks) {
      //     callback.onEvaluateResponseEnd({ valid, retry });
      //   }
      //   if (!valid && retry) {
      //     response = await this._makeObservation(
      //       step,
      //       call,
      //       extraFunctionCallParams,
      //       modelParams,
      //       functions,
      //       goal,
      //       previousSteps,
      //       currentStep,
      //       selfEvaluate,
      //       retryCount + 1
      //     );
      //   }
      // }

      // return response;

      // TODO the main loop expects a response format
      return {
        id: uuid.v4(),
        created: new Date(),
        choices: [
          {
            index: 0,
            message: {
              content,
              role: MessageRole.assistant,
            },
          },
        ],
        n: 1,
      };
    }

    async _callFunction(call: FunctionCall, extraFunctionCallParams: any) {
      const { email, indexName } = extraFunctionCallParams;
      let args: any;
      try {
        args = JSON.parse(call.arguments);
      } catch (err) {
        logger.error('Error parsing call arguments:', String(err), call.arguments);
        return "I don't know how to answer that";
      }
      for (let callback of this.currentCallbacks) {
        callback.onFunctionCallStart({ call, args });
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
        } else if (func = this.semanticFunctions.find(f => f.name === call.name)) {
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
        } else if (composition = this.compositions.find(c => c.name === call.name)) {
          const compositionResponse = await executionsService.executeComposition({
            workspaceId: this.workspaceId,
            username: this.username,
            composition,
            args,
            params: { maxTokens: 1024 },
          });
          const content = compositionResponse.response.myargs.content;
          response = { choices: [{ message: { content } }] };
        } else if (agent = this.subAgents.find(a => a.name === call.name)) {
          const agentResponse = await executionsService.executeAgent({
            workspaceId: this.workspaceId,
            username: this.username,
            agent,
            args,
          });
          response = agentResponse.content;
        } else {
          if (call.name === 'email') {
            args.name = this.name;
            args.email = email;
          }
          response = await toolService.call(call.name, args);
        }
      } catch (err) {
        logger.debug('Error calling tool:', call.name, String(err), err.stack);
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
      const res = await llmService.createChatCompletion('openai', request);
      const ans = res.choices[0].message.content;
      const valid = ans !== "I don't know";
      return valid;
    }

    _onEnd({ response, errors }: AgentOnEndParams) {
      for (let callback of this.currentCallbacks) {
        callback.onAgentEnd({
          name: this.name,
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
