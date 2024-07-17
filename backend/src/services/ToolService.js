export function ToolService({ logger, registry }) {

  logger.log('debug', 'Tool registry includes', getToolsList());

  function splitKey(key) {
    return key.split('__').map(str => str.trim());
  }

  function getTool(key) {
    const [toolKey] = splitKey(key);
    return registry[toolKey];
  }

  function call(key, args, raw) {
    logger.debug('Calling "%s" with args:', key, args);
    const [toolKey, instance] = splitKey(key);
    const tool = registry[toolKey];
    if (!tool) {
      return 'Invalid tool call: ' + toolKey;
    }
    return tool.call(args, raw, instance);
  }

  function getOpenAPIMetadata(key) {
    const [toolKey, instance] = splitKey(key);
    if (instance) {
      return registry[toolKey].getOpenAPIMetadata().find(t => t.name === key);
    }
    return registry[toolKey].getOpenAPIMetadata();
  }

  function getAllMetadata(keys) {
    const toolKeys = keys?.map(k => splitKey(k)[0]);
    return Object.entries(registry)
      .filter(([key, _]) => !keys || toolKeys.includes(key))
      .flatMap(([_, tool]) => {
        if (tool.multitool) {
          return tool.getOpenAPIMetadata();
        }
        return [tool.getOpenAPIMetadata()];
      })
      ;
  }

  function getToolsList(keys) {
    const toolKeys = keys?.map(k => splitKey(k)[0]);
    return Object.entries(registry)
      .filter(([key, _]) => !keys || toolKeys.includes(key))
      .flatMap(([key, tool]) => {
        if (tool.multitool) {
          return tool.getOpenAPIMetadata().map(t => `${t.name}: ${t.description}`);
        }
        return [`${key}: ${tool.__description}`];
      })
      .join('\n');
  }

  function getToolNames(keys) {
    const toolKeys = keys?.map(k => splitKey(k)[0]);
    return Object.entries(registry)
      .filter(([key, _]) => !keys || toolKeys.includes(key))
      .flatMap(([_, tool]) => {
        if (tool.multitool) {
          return tool.getOpenAPIMetadata().map(t => t.name);
        }
        return [tool.__name];
      })
      .join(', ');
  }

  function getTools() {
    return Object.entries(registry).flatMap(([k, v]) => {
      if (v.multitool) {
        return v.getOpenAPIMetadata().map(t => ({
          key: t.name,
          name: t.name,
          description: t.description,
        }));
      }
      return {
        key: k,
        name: v.__name,
        description: v.__description,
      }
    });
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
