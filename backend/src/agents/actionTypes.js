export class AgentAction {

  constructor(action, toolInput, originalText) {
    this.action = action;
    this.toolInput = toolInput;
    this.originalText = originalText;
  }
}

export class AgentFinish {

  constructor(returnValues, originalText) {
    this.returnValues = returnValues;
    this.originalText = originalText;
  }
}
