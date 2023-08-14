export class Message {

  constructor({ role, content, name, function_call }) {
    this.role = role;
    this.content = content;
    this.name = name;
    this.function_call = function_call;
  }

  toJson() {
    return {
      role: this.role,
      content: this.content,
      name: this.name,
      function_call: this.function_call,
    };
  }
}

export class AssistantMessage extends Message {

  constructor(content) {
    super({
      role: 'assistant',
      content
    });
  }
}

export class FunctionMessage extends Message {

  constructor(name, content) {
    super({
      role: 'function',
      content,
      name
    });
  }
}

export class SystemMessage extends Message {

  constructor(content) {
    super({
      role: 'system',
      content
    });
  }
}

export class UserMessage extends Message {

  constructor(content) {
    super({
      role: 'user',
      content
    });
  }
}
