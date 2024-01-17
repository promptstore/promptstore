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
    '  "action": <tool name>,\n' +
    '  "action_input": <tools args - Use only the properties in the args defition. DO NOT add an "input" property unless it is in args>\n' +
    '}\n' +
    '```',
  ];
}
