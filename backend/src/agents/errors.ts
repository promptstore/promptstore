export class OutputParserException extends Error {

  options: any;

  constructor(message: string, options: any) {
    super(message);
    this.options = options;
  }
}

export class AgentError extends Error {

  constructor(message: string) {
    super(message);
  }

  get errors() {
    return [{ message: this.message }];
  }

}
