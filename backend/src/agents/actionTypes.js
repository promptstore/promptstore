class AgentAction {

  constructor(action, toolInput, originalText) {
    this.action = action;
    this.toolInput = toolInput;
    this.originalText = originalText;
  }
}

class AgentFinish {

  constructor(returnValues, originalText) {
    this.returnValues = returnValues;
    this.originalText = originalText;
  }
}

module.exports = {
  AgentAction,
  AgentFinish,
}