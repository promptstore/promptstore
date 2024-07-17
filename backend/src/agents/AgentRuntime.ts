import { Composition } from '../core/compositions/Composition';
import { SemanticFunction } from '../core/semanticfunctions/SemanticFunction';

export class AgentRuntime {

  agentType: string;
  agents: any;
  allowedTools: string[];
  compositions: Composition[];
  functions: SemanticFunction[];
  subAgents: any[];
  args: any;
  indexName: string;
  isChat: boolean;
  model: string;
  name: string;
  provider: string;
  selfEvaluate: boolean;
  useFunctions: boolean;

  constructor({
    agentType,
    agents,
    allowedTools,
    compositions,
    functions,
    subAgents,
    args,
    indexName,
    isChat,
    model,
    name,
    provider,
    selfEvaluate,
    useFunctions,
  }) {
    this.agentType = agentType;
    this.agents = agents;
    this.allowedTools = allowedTools;
    this.compositions = compositions;
    this.functions = functions;
    this.subAgents = subAgents;
    this.args = args;
    this.indexName = indexName;
    this.isChat = isChat;
    this.model = model;
    this.name = name;
    this.provider = provider;
    this.selfEvaluate = selfEvaluate;
    this.useFunctions = useFunctions;
  }

  async call({ email, callbacks, args, username, workspaceId, parentAgentName }) {
    const modelParams = { max_tokens: 1024 };
    const options = {
      name: this.name,
      isChat: this.isChat,
      model: this.model,
      modelParams,
      provider: this.provider,
      workspaceId,
      username,
      useFunctions: this.useFunctions,
      semanticFunctions: this.functions,
      compositions: this.compositions,
      subAgents: this.subAgents,
    };
    let agent: any;
    if (this.agentType === 'plan') {
      agent = new this.agents.PlanAndExecuteAgent(options);
    } else if (this.agentType === 'openai') {
      agent = new this.agents.OpenAIAssistantAgent(options);
    } else if (this.agentType === 'react') {
      agent = new this.agents.MRKLAgent(options);
    } else if (this.agentType === 'simple') {
      agent = new this.agents.SimpleAgent(options);
    } else {
      const message = 'Unsupported agent type: ' + this.agentType;
      throw new Error(message);
    }
    const extraFunctionCallParams = {
      email: process.env.EMAIL_OVERRIDE || email,
      indexName: this.indexName,
    };
    const goal = [this.args?.goal, args?.goal].filter(g => g).join('\n\n');
    args = { ...(this.args || {}), ...(args || {}) };
    if (goal) {
      args.goal = goal;
    }
    const response = await agent.run({
      callbacks,
      args,
      allowedTools: this.allowedTools,
      extraFunctionCallParams,
      selfEvaluate: this.selfEvaluate,
      parentAgentName,
    });
    console.log('Return agent runtime response:', response);
    return response;
  }

}