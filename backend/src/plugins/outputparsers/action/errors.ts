export class OutputParserException extends Error {

  options: any;

  constructor(message: string, options: any) {
    super(message);
    this.options = options;
  }
}
