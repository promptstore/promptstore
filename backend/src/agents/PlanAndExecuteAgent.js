import EventEmitter from 'events';
import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import uuid from 'uuid';

import { Tracer } from '../core/Tracer';
import * as utils from '../utils';

import { AssistantMessage, FunctionMessage, Message, UserMessage } from './messageTypes';

dayjs.extend(relativeTime);

const PLAN_OUTPUT_PARSER = 'numberedlist';
const PROMPTSET_SKILL = 'plan';

export default ({ logger, services }) => {

  const { llmService, parserService, promptSetsService, searchService, tracesService, tool } = services;

  class PlanAndExecuteAgent {

    model;
    modelParams;
    workspaceId;
    username;
    history;
    emitter;
    tracer;
    startTime;

    constructor({ model, modelParams, workspaceId, username }) {
      this.model = model || 'gpt-3.5-turbo';
      this.modelParams = modelParams || {};
      this.workspaceId = workspaceId;
      this.username = username;
      this.history = [];
      this.emitter = new EventEmitter();
      this.tracer = new Tracer('plan-and-execute agent - ' + new Date().toISOString(), 'agent');
    }

    reset() {
      this.history = [];
    }

    async run(goal, toolKeys, callParams, selfEvaluate) {
      logger.info('start plan-and-execute agent');
      let startTime, endTime;
      this.startTime = new Date();
      this.tracer
        .push({
          id: uuid.v4(),
          type: 'plan-and-execute agent',
          goal,
          allowedTools: toolKeys,
          callParams,
          selfEvaluate,
          startTime: this.startTime.getTime(),
        })
        .down();
      this.emitter.emit('event', 'Goal:\n' + goal);
      // query
      const args = {
        content: goal,
      };

      // get plan
      const promptSets = await promptSetsService.getPromptSetsBySkill(this.workspaceId, PROMPTSET_SKILL);
      if (!promptSets.length) {
        throw new Error('Prompt not found');
      }

      logger.info('start filling template');
      startTime = new Date();
      this.tracer.push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messages: promptSets[0].prompts,
        args,
        startTime: startTime.getTime(),
      });
      const rawMessages = utils.getMessages(promptSets[0].prompts, args, 'es6');
      const messages = this._mapMessagesToTypes(rawMessages);
      this.history.push(...messages);
      endTime = new Date();
      this.tracer
        .addProperty('messages', rawMessages)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);

      const {
        maxTokens = 255,
        n = 1
      } = this.modelParams;
      const modelParams = { max_tokens: maxTokens, n };

      logger.info('start model:', this.model);
      startTime = new Date()
      this.tracer.push({
        id: uuid.v4(),
        type: 'call-model: plan',
        model: this.model,
        modelParams,
        messages: rawMessages,
        startTime,
      });
      let res;
      let request = {
        model: this.model,
        model_params: modelParams,
        prompt: { messages },
      };
      res = await llmService.createChatCompletion({
        provider: 'openai',
        request,
      });
      logger.debug('res:', res);

      this.history.push(new AssistantMessage(res.choices[0].message.content));
      const plan = await parserService.parse(PLAN_OUTPUT_PARSER, res.choices[0].message.content);
      this.emitter.emit('event', 'Plan:' + plan.reduce((a, step, i) => {
        a += `\n${i + 1}. ${step}`;
        return a;
      }, ''));
      endTime = new Date();
      this.tracer
        .addProperty('response', res)
        .addProperty('plan', plan)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);

      let functions = tool.getAllMetadata(toolKeys);

      if (toolKeys.includes('searchIndex')) {
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

      logger.log('debug', 'functions:', functions || 'none selected');

      if (functions.length === 0) {
        functions = undefined;
      }

      logger.info('start execution loop');
      startTime = new Date()
      this.tracer
        .push({
          id: uuid.v4(),
          type: 'execute-plan',
          plan: plan,
          startTime,
        })
        .down();

      // execute plan loop
      let i = 1;
      for (const step of plan) {
        this.emitter.emit('event', `Step ${i}. ${step}`);
        this.history.push(new UserMessage(step));
        startTime = new Date()
        request = {
          model: this.model,
          model_params: modelParams,
          functions,
          prompt: { messages: this._getMessages() },
        }
        this.tracer.push({
          id: uuid.v4(),
          type: 'evaluate-step',
          step,
          messages: this._getMessages(),
          model: this.model,
          modelParams,
          functions,
          startTime,
        });
        res = await llmService.createChatCompletion({
          provider: 'openai',
          request,
        });
        this.history.push(new Message(res.choices[0].message));
        const call = res.choices[0].message.function_call;
        endTime = new Date();
        this.tracer
          .addProperty('response', res)
          .addProperty('call', call)
          .addProperty('endTime', endTime.getTime())
          .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
          .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
          .addProperty('success', true)
          .down();

        if (call) {
          res = await this._makeObservation(call, callParams, modelParams);

          if (selfEvaluate) {
            this.emitter.emit('event', 'Thought: Is this a valid answer?');
            // validate answer
            this.tracer.down();
            const [valid, r] = await this._checkValidObservation(step, res, call, callParams, modelParams);
            this.tracer.up();
            if (!valid) {
              return res.choices[0].message.content;
            }
            res = r;
          }

          this.history.push(new Message(res.choices[0].message));

        } else {
          this.emitter.emit('event', 'Response:\n' + res.choices[0].message.content);
        }

        this.tracer.up();
        i += 1;
      }
      endTime = new Date();
      this.tracer
        .up()
        .addProperty('response', res)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);

      const traceRecord = this.tracer.close();
      tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);

      return res.choices[0].message.content;
    }

    async _checkValidObservation(step, res, call, callParams, modelParams, retryCount = 0) {
      let valid = this._validateAnswer(step, res.choices[0].message.content);
      if (!valid) {
        this.emitter.emit('event', 'Response: No, let me try again.');
        // try again
        res = await this._makeObservation(call, callParams, modelParams);
        this.emitter.emit('event', 'Thought: Is this a valid answer?');
        if (retryCount === 0) {
          // validate answer again
          this.tracer.down();
          const result = await this._checkValidObservation(step, res, call, agentName, email, indexName, modelParams, retryCount + 1);
          this.tracer.up();
          return result;
        } else {
          this.emitter.emit('event', 'Response: No');
          return [valid, res];
        }
      }
      this.emitter.emit('event', 'Response: Yes');
      return [valid, res];
    }

    async _makeObservation(call, callParams, modelParams) {
      let startTime = new Date();
      let endTime;
      this.tracer.push({
        id: uuid.v4(),
        type: 'call-tool',
        call,
        model: this.model,
        modelParams,
        startTime,
      });
      this.emitter.emit('event', 'Call External Tool: ' + call.name);
      let res = await this._callFunction(call, callParams);
      this.history.push(new FunctionMessage(call.name, res));
      endTime = new Date();
      this.tracer
        .addProperty('response', res)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);

      startTime = new Date();
      this.tracer.push({
        id: uuid.v4(),
        type: 'call-model: observe',
        messages: this._getMessages(),
        model: this.model,
        modelParams,
        startTime,
      });
      const request = {
        model: this.model,
        model_params: modelParams,
        prompt: { messages: this._getMessages() },
      };
      res = await llmService.createChatCompletion({
        provider: 'openai',
        request,
      });
      this.emitter.emit('event', 'Observation:\n' + res.choices[0].message.content);
      endTime = new Date();
      this.tracer
        .addProperty('response', res)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);

      return res;
    }

    async _callFunction(call, callParams) {
      const { agentName, email, indexName } = callParams;
      try {
        let args = JSON.parse(call.arguments);
        if (call.name === 'searchIndex') {
          const res = await searchService.search(indexName, args.input);
          return res.hits.join('\n\n');
        }
        if (call.name === 'email') {
          args = {
            ...args,
            agentName,
            email,
          };
        }
        const res = await tool.call(call.name, args);
        // logger.debug('tool result:', res);
        return res;
      } catch (err) {
        console.log('Error calling tool:', call.name);
        return 'Invalid tool call';
      }
    }

    _getMessages() {
      return this.history.map(m => m.toJson());
    }

    _mapMessagesToTypes(rawMessages) {
      return rawMessages.map((m) => new Message(m));
    }

    _printMessages(messages) {
      return messages.map((m) => m.content).join('\n\n');
    }

    async _validateAnswer(question, response) {
      logger.log('debug', 'question:', question);
      logger.log('debug', 'response:', response);
      const messages = [
        {
          role: 'user',
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
      const startTime = new Date()
      this.tracer.push({
        id: uuid.v4(),
        type: 'evaluate-response',
        messages,
        response,
        model: 'gpt-4',
        modelParams,
        startTime,
      });
      const request = {
        model: 'gpt-4',
        model_params: modelParams,
        prompt: messages,
      };
      const res = await llmService.createChatCompletion({
        provider: 'openai',
        request,
      });
      const ans = res.choices[0].message.content;
      const valid = ans !== "I don't know";
      const endTime = new Date();
      this.tracer
        .addProperty('valid', valid)
        .addProperty('endTime', endTime.getTime())
        .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
        .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
        .addProperty('success', true);
      return valid;
    }
  }

  return PlanAndExecuteAgent;

}
