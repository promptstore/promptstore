export function ToolService({ logger, registry }) {

  logger.log('debug', 'Tool registry includes', getToolsList());

  function getTool(key) {
    return registry[key];
  }

  function call(key, args, raw) {
    logger.debug('Calling "%s" with args:', key, args);
    const tool = registry[key];
    if (!tool) {
      return 'Invalid tool call';
    }
    return tool.call(args, raw);
  }

  function getOpenAPIMetadata(key) {
    return registry[key].getOpenAPIMetadata();
  }

  function getAllMetadata(keys) {
    return Object.entries(registry)
      .filter(([key, _]) => !keys || keys.includes(key))
      .map(([_, tool]) => tool.getOpenAPIMetadata())
      ;
  }

  function getToolsList(keys) {
    return Object.entries(registry)
      .filter(([key, _]) => !keys || keys.includes(key))
      .map(([key, tool]) => {
        return `${key}: ${tool.__description}`;
      })
      .join('\n');
  }

  function getToolNames(keys) {
    return Object.entries(registry)
      .filter(([key, _]) => !keys || keys.includes(key))
      .map(([_, tool]) => tool.__name)
      .join(', ');
  }

  function getTools() {
    return Object.entries(registry).map(([k, v]) => ({
      key: k,
      name: v.__name,
      description: v.__description,
    }));
  }

  return {
    call,
    getAllMetadata,
    getOpenAPIMetadata,
    getToolNames,
    getToolsList,
    getTool,
    getTools,
  };
}
