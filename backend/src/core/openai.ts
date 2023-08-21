import { OpenAIMessage } from './openai_types';
import { MessageRole } from './RosettaStone';

export class OpenAIMessageImpl implements OpenAIMessage {

  role: MessageRole;
  content: string;
  name?: string;
  function_call?: object;

  constructor({ role, content, name, function_call }: any) {
    this.role = role;
    this.content = content;
    this.name = name;
    this.function_call = function_call;
  }

}

export class AssistantMessage implements OpenAIMessage {

  role = MessageRole.assistant;
  content: string;
  name?: string;
  function_call?: object;

  constructor(content: string, function_call?: object, name?: string) {
    this.content = content;
    this.function_call = function_call;
    this.name = name;
  }

}

export class FunctionMessage implements OpenAIMessage {

  role = MessageRole.function;
  content: string;
  name: string;

  constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }

}

export class UserMessage implements OpenAIMessage {

  role = MessageRole.user;
  content: string;
  name?: string;

  constructor(content: string, name?: string) {
    this.content = content;
    this.name = name;
  }

}

export class SystemMessage implements OpenAIMessage {

  role = MessageRole.system;
  content: string;
  name?: string;

  constructor(content: string, name?: string) {
    this.content = content;
    this.name = name;
  }

}