export function getPromptTemplate(toolDefinitions: string, toolKeys: string) {
  return [
    'Answer the following questions as best you can. You have access to ' +
    'the following tools:',

    toolDefinitions,

    'The way you use the tools is by specifying a json blob. Specifically, ' +
    'this json should have an `action` key (with the name of the tool to ' +
    'use) and an `action_input` key (with the input to the tool going here).',

    `The only values that should be in the "action" field are: ' +
    '"Final Answer" or ${toolKeys}`,

    'The $JSON_BLOB should only contain a SINGLE action. Do NOT return ' +
    'a list of multiple actions. Here is an example of a valid $JSON_BLOB:',

    '```\n' +
    '{\n' +
    '  "action": $TOOL_NAME,\n' +
    '  "action_input": $INPUT\n' +
    '}\n' +
    '```',

    'ALWAYS use the following format:',

    'Question: the input question you must answer\n' +
    'Thought: you should always think about what to do\n' +
    'Action:\n' +
    '```\n' +
    '$JSON_BLOB\n' +
    '```\n' +
    'Observation: the result of the action\n' +
    '... (this Thought/Action/Observation can repeat N times)\n' +
    'Thought: I now know the final answer\n' +
    'Final Answer: the final answer to the original input question',

    'Begin! Reminder to always use the exact characters `Final Answer` ' +
    'when responding.\n' +
    'Thought:'
  ];
}
