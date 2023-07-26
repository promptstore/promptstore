const EventEmitter = require('events');

const utils = require('../utils');

const { AssistantMessage, FunctionMessage, Message, UserMessage } = require('./messageTypes');

const PLAN_OUTPUT_PARSER = 'numberedlist';
const PROMPTSET_SKILL = 'plan';

module.exports = ({ logger, services }) => {

  const { llmService, parserService, promptSetsService, searchService, tool } = services;

  class PlanAndExecuteAgent {

    constructor({ model, modelParams }) {
      this.model = model || 'gpt-3.5-turbo';
      this.modelParams = modelParams || {};
      this.history = [];
      this.emitter = new EventEmitter();
    }

    reset() {
      this.history = [];
    }

    async run(goal, toolKeys, callParams, selfEvaluate) {
      this.emitter.emit('event', 'Goal:\n' + goal);
      // query
      const request = {
        content: goal,
      };

      // get plan
      const promptSets = await promptSetsService.getPromptSetsBySkill(PROMPTSET_SKILL);
      if (!promptSets.length) {
        throw new Error('Prompt not found');
      }

      const rawMessages = utils.getMessages(promptSets[0].prompts, request, 'es6');
      const messages = this._mapMessagesToTypes(rawMessages);
      this.history.push(...messages);

      const {
        maxTokens = 255,
        n = 1
      } = this.modelParams;
      const modelParams = { maxTokens, n };

      let res;

      res = await llmService.createChatCompletion('openai', messages, this.model, maxTokens, n);
      logger.debug('res:', res);
      this.history.push(new AssistantMessage(res.choices[0].message.content));
      const plan = await parserService.parse(PLAN_OUTPUT_PARSER, res.choices[0].message.content);
      this.emitter.emit('event', 'Plan:' + plan.reduce((a, step, i) => {
        a += `\n${i + 1}. ${step}`;
        return a;
      }, ''));

      let functions = tool.getAllMetadata(toolKeys);

      if (toolKeys.includes('searchIndex')) {
        functions.push({
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

      // execute plan loop
      let i = 1;
      for (const step of plan) {
        this.emitter.emit('event', `Step ${i}. ${step}`);
        this.history.push(new UserMessage(step));
        res = await llmService.createChatCompletion('openai', this._getMessages(), this.model, maxTokens, n, functions);
        this.history.push(new Message(res.choices[0].message));
        const call = res.choices[0].message.function_call;

        if (call) {
          res = await this._makeObservation(call, callParams, modelParams);

          if (selfEvaluate) {
            this.emitter.emit('event', 'Thought: Is this a valid answer?');
            // validate answer
            const [valid, r] = await this._checkValidObservation(step, res, call, callParams, modelParams);
            if (!valid) {
              return res.choices[0].message.content;
            }
            res = r;
          }

          this.history.push(new Message(res.choices[0].message));

        } else {
          this.emitter.emit('event', 'Response:\n' + res.choices[0].message.content);
        }

        i += 1;
      }

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
          return await this._checkValidObservation(step, res, call, agentName, email, indexName, modelParams, retryCount + 1);
        } else {
          this.emitter.emit('event', 'Response: No');
          return [valid, res];
        }
      }
      this.emitter.emit('event', 'Response: Yes');
      return [valid, res];
    }

    async _makeObservation(call, callParams, modelParams) {
      this.emitter.emit('event', 'Call External Tool: ' + call.name);
      let res = await this._callFunction(call, callParams);
      this.history.push(new FunctionMessage(call.name, res));
      res = await llmService.createChatCompletion('openai', this._getMessages(), this.model, modelParams.maxTokens, modelParams.n);
      this.emitter.emit('event', 'Observation:\n' + res.choices[0].message.content);
      return res;
    }

    async _callFunction(call, callParams) {
      const { agentName, email, indexName } = callParams;
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
      const res = await llmService.createChatCompletion('openai', messages, 'gpt-4', 1, 1);
      const ans = res.choices[0].message.content;
      return ans !== "I don't know";
    }
  }

  return PlanAndExecuteAgent;

}
