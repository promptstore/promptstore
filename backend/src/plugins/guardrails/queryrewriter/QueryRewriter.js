function QueryRewriter({ __name, __metadata, constants, logger, services }) {

  const { executionsService } = services;

  async function scan(content) {
    const { response } = await executionsService.executeFunction({
      workspaceId: constants.WORKSPACE_ID,
      username: constants.USERNAME,
      semanticFunctionName: constants.SEMANTIC_FUNCTION_NAME,
      args: { content },
    });
    return { text: response.choices[0].message.content };
  }

  return {
    __name,
    __metadata,
    scan,
  };

}

export default QueryRewriter;
