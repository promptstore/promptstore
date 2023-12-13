import { OpenAIMessage } from './openai_types';
import {
  ContentType,
  FunctionCall,
  MessageRole,
} from '../conversions/RosettaStone';

export class OpenAIMessageImpl<T> implements OpenAIMessage<T> {

  role: MessageRole;
  content: T;
  name?: string;
  function_call?: FunctionCall;

  constructor({ role, content, name, function_call }: OpenAIMessage<T>) {
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
  function_call?: FunctionCall;

  constructor(content: string, function_call?: FunctionCall, name?: string) {
    this.content = content;
    this.function_call = function_call;
    this.name = name;
  }

}

/**
 * @deprecated
 */
export class FunctionMessage implements OpenAIMessage {

  role = MessageRole.function;
  content: string;
  name: string;

  constructor(content: string, name: string) {
    this.content = content;
    this.name = name;
  }

}

export class ToolMessage implements OpenAIMessage {

  role = MessageRole.tool;
  content: string;  // The contents of the tool message.
  tool_call_id: string;  // Tool call that this message is responding to.

  constructor(content: string, tool_call_id: string) {
    this.content = content;
    this.tool_call_id = tool_call_id;
  }

}

export class UserMessage implements OpenAIMessage {

  role = MessageRole.user;
  content: ContentType;
  name?: string;

  constructor(content: ContentType, name?: string) {
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
