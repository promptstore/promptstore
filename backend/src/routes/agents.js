const { fillTemplate } = require('../utils');

const FORMAT_INSTRUCTIONS = `Use the following format in your response:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [\${tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;

const PREFIX = `Answer the following questions as best you can. You have access to the following tools:`;
const SUFFIX = `Begin!
Question: \${input}
Thought: \${agent_scratchpad}`;


module.exports = ({ app, auth, logger, services }) => {

  const { tool } = services;

  const tools = [
    {
      name: 'serpapi',
      description: 'a search engine. useful for when you need to answer questions about current events. input should be a search query.',
    },
    {
      name: 'calculator',
      description: 'Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator.',
    }
  ];

  const getTemplate = () => {
    const formatInstructions = fillTemplate(FORMAT_INSTRUCTIONS, {
      tool_names: tools.map((tool) => tool.name),
    });
    const template = [
      PREFIX,
      tools.map((tool) => `${tool.name}: ${tool.description}`).join('\n'),
      formatInstructions,
      SUFFIX
    ].join('\n\n');
    return template;
  };

  app.post('/api/agent-executions', async (req, res, next) => {

  });

}