export class AgentAction {

  action: string;
  toolInput: string;
  originalText: string;

  constructor(action: string, toolInput: string, originalText: string) {
    this.action = action;
    this.toolInput = toolInput;
    this.originalText = originalText;
  }
}

export class AgentFinish {

  returnValues: any;
  originalText: string;

  constructor(returnValues: any, originalText: string) {
    this.returnValues = returnValues;
    this.originalText = originalText;
  }
}

export class Step {

  step: string;
  response: string;

  constructor(step: string, response: string) {
    this.step = step;
    this.response = response;
  }

  toString() {
    return this.step + ', Response: ' + this.response;
  }
}
