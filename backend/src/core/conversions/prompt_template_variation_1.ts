export function getPromptTemplate(toolDefinitions: string, toolKeys: string) {
  return [
    'Respond to the human as helpfully and accurately as possible. You ' +
    'have access to the following tools:',

    toolDefinitions,

    'Use a json blob to specify a tool by providing an action key (tool ' +
    'name) and an action_input key (tool input).',

    `Valid "action" values: "Final Answer" or ${toolKeys}`,

    'Provide only ONE action per $JSON_BLOB, as shown:',

    '```\n' +
    '{\n' +
    '  "action": $TOOL_NAME,\n' +
    '  "action_input": $INPUT\n' +
    '}\n' +
    '```',

    'Follow this format:',

    'Question: input question to answer\n' +
    'Thought: consider previous steps and the current objective\n' +
    'Action:\n' +
    '```\n' +
    '$JSON_BLOB\n' +
    '```\n' +
    'Observation: action result\n' +
    '... (repeat Thought/Action/Observation N times)\n' +
    'Thought: I know what to respond\n' +
    'Action:\n' +
    '```\n' +
    '{\n' +
    '  "action": "Final Answer",\n' +
    '  "action_input": "Final response to human"\n' +
    '}\n' +
    '```',

    'Begin! Reminder to ALWAYS respond with a valid json blob of a single ' +
    'action, and to wrap the json blob within triple backticks. Use tools ' +
    'if necessary. Respond directly if appropriate. ' +
    'Format is Action:```$JSON_BLOB```then Observation:.\n' +
    'Thought:'
  ];
}
