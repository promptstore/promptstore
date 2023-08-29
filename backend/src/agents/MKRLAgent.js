import EventEmitter from 'events';
import trim from 'lodash.trim';

import * as utils from '../utils';

import { AgentAction, AgentFinish } from './actionTypes';
import { OutputParserException } from './errorTypes';
import { Message, UserMessage } from './messageTypes';

const FINAL_ANSWER_ACTION = 'Final Answer:';
const PROMPTSET_SKILL = 'react_plan';

const STOP = [
  'Observation:',
  '	Observation:'
];

export default ({ logger, services }) => {

  const { llmService, promptSetsService, tool } = services;

  class MKRLAgent {

    constructor({ isChat = false, model, modelParams, workspaceId, username }) {
      this.model = model || (isChat ? 'gpt-3.5-turbo' : 'text-davinci-003');
      this.modelParams = modelParams || {};
      this.workspaceId = workspaceId;
      this.username = username;
      this.history = [];
      this.emitter = new EventEmitter();
      this.maxIterations = 6;
      this.maxExecutionTime = 30000;
      this.isChat = isChat;
    }

    reset() {
      this.history = [];
    }

    async run(input, toolKeys, callParams, selfEvaluate) {
      let iterations = 0;
      let elapsedTime = 0.0;
      let startTime = new Date();

      const request = {
        input,
        tools: tool.getToolsList(toolKeys),
        tool_names: tool.getToolNames(toolKeys),
        agent_scratchpad: '',  // TODO variables should be optional by default
      };
      const promptSets = await promptSetsService.getPromptSetsBySkill(this.workspaceId, PROMPTSET_SKILL);
      if (!promptSets.length) {
        throw new Error('Prompt not found');
      }

      let messages;

      const rawMessages = utils.getMessages(promptSets[0].prompts, request, 'es6');
      messages = this._mapMessagesToTypes(rawMessages);

      // enter the agent loop
      while (this._shouldContinue(iterations, elapsedTime)) {
        this.emitter.emit('event', this._printMessages(messages) + '...');
        this.history.push(...messages);
        messages = await this._next();
        if (messages[0] instanceof AgentFinish) {
          return messages[0].returnValues.output;
        }
        iterations += 1;
      }

      return 'Done';
    }

    async _next() {
      const {
        maxTokens = 255,
        n = 1
      } = this.modelParams;
      const modelParams = {
        max_tokens: maxTokens,
        n,
        stop: STOP,
      };
      let request, res;
      if (this.isChat) {
        request = {
          model: this.model,
          model_params: modelParams,
          prompt: { messages: this._getMessages() },
        };
        res = await llmService.createChatCompletion({ provider: 'openai', request });
      } else {
        request = {
          model: this.model,
          model_params: modelParams,
          prompt: { messages: this._getPrompt() },
        };
        res = await llmService.createCompletion({ provider: 'openai', request });
      }
      logger.log('debug', 'res:', res);
      const message = await this._processResult(this.isChat ? res.choices[0].message : res.choices[0]);
      return [message];
    }

    _shouldContinue(iterations, elapsedTime) {
      if (this.maxIterations && iterations >= this.maxIterations) {
        return false;
      }
      if (this.maxExecutionTime && elapsedTime >= this.maxExecutionTime) {
        return false;
      }
      return true;
    }

    async _processResult(rawMessage) {
      const content = this.isChat ? rawMessage.content : rawMessage.text;
      this.emitter.emit('event', content);
      this.history.push(...this._mapMessagesToTypes([rawMessage]));
      let output;
      try {
        output = this._parseOutput(content);
      } catch (err) {
        logger.error(err);
        if (err instanceof OutputParserException) {
          const { sendToLLM, observation } = err.options;
          if (sendToLLM) {
            return this._constructScratchpad({ observation })
          }
        }
        throw err;
      }
      let result;
      if (output instanceof AgentAction) {
        result = await this._callTool(output);
        return this._constructScratchpad(result);
      }
      if (output instanceof AgentFinish) {
        return output;
      }
    }

    async _callTool(output) {
      const { action, toolInput } = output;
      this.emitter.emit('event', `--------------\nCall: ${action} ("${toolInput}")`);
      const observation = await tool.call(action, { input: toolInput });
      this.emitter.emit('event', `Result: ${observation}\n--------------`);
      return {
        action: output,
        observation,
      };
    }

    _constructScratchpad({ action, observation }) {
      const thoughts = [
        'Observation: ' + observation,
        'Thought: '
      ].join('\n');
      return new UserMessage(thoughts);
    }

    _parseOutput(content) {
      const hasFinalAnswer = content.includes(FINAL_ANSWER_ACTION);
      const regex = new RegExp(/Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/, 's');
      const actionMatch = content.match(regex);
      if (actionMatch) {
        if (hasFinalAnswer) {
          throw new Error(`Parsing LLM output produced both a final answer and a parseable action: ${content}`);
        }
        const action = actionMatch[1];
        const actionInput = actionMatch[2];
        let toolInput = actionInput.trim();
        // ensure if its a well formed SQL query we don't remove any trailing " chars
        if (!toolInput.startsWith('SELECT ')) {
          toolInput = trim(toolInput, '"');
        }
        return new AgentAction(action, toolInput, content);
      } else if (hasFinalAnswer) {
        return new AgentFinish({
          output: content.split(FINAL_ANSWER_ACTION)[1].trim(),
          content,
        });
      }
      const re1 = new RegExp(/Action\s*\d*\s*:[\s]*(.*?)/, 's');
      const re2 = new RegExp(/[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/, 's');
      const match1 = content.match(re1);
      const match2 = content.match(re2);
      if (!match1) {
        throw new OutputParserException(
          `Could not parse LLM output: ${content}`,
          {
            observation: "Invalid Format: Missing 'Action:' after 'Thought:'",
            llmOutput: content,
            sendToLLM: true,
          }
        );
      } else if (!match2) {
        throw new OutputParserException(
          `Could not parse LLM output: ${content}`,
          {
            observation: "Invalid Format: Missing 'Action Input:' after 'Thought:'",
            llmOutput: content,
            sendToLLM: true,
          }
        );
      } else {
        throw new OutputParserException(`Could not parse LLM output: ${content}`);
      }
    }

    _mapMessagesToTypes(rawMessages) {
      return rawMessages.map((m) => new Message(m));
    }

    _printMessages(messages) {
      return messages
        .filter((m) => m.role !== 'system')
        .map((m) => m.content).join('\n\n');
    }

    _getMessages() {
      return this.history.map(m => m.toJson());
    }

    _getPrompt() {
      return this.history.map(m => m.toJson()).map(m => m.content).join('\n\n');
    }
  }

  return MKRLAgent;

}
