export default {
  agents: (rec) => {
    const texts = [
      rec.name,
      rec.goal,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'agents';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Agents',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        agentType: rec.agentType,
      },
    };
  },

  apps: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'apps';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'App',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        appType: rec.appType,
      },
    };
  },

  compositions: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'compositions';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Composition',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
      },
    };
  },

  dataSources: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'data-sources';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Data Source',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        documentType: rec.documentType,
      },
    };
  },

  destinations: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'destinations';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Destination',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        documentType: rec.documentType,
        type: rec.type,
      },
    };
  },

  functions: (rec) => {
    const texts = [
      rec.name,
      rec.tags?.join(' '),
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'functions';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Semantic Function',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        documentType: rec.documentType,
        tags: rec.tags,
      },
    };
  },

  indexes: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'indexes';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Semantic Index',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        vectorStoreProvider: rec.vectorStoreProvider,
        graphStoreProvider: rec.graphStoreProvider,
      },
    };
  },

  models: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'models';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Model',
      type,
      name: rec.name,
      key: rec.key,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        type: rec.type,
        provider: rec.provider,
      },
    };
  },

  promptSets: (rec) => {
    const texts = [
      rec.name,
      rec.tags?.join(' '),
      rec.description,
      rec.prompts?.map(p => p.prompt),
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'prompt-sets';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Prompt Template',
      type,
      name: rec.name,
      key: rec.skill,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
        tags: rec.tags,
        templateEngine: rec.templateEngine,
      },
    };
  },

  transformations: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'transformations';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Transformation',
      type,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        dataSourceId: rec.dataSourceId,
        destinationIds: rec.destinationIds,
        indexId: rec.indexId,
        vectorStoreProvider: rec.engine,
      },
    };
  },

  uploads: (rec) => {
    const texts = [
      rec.filename,
      rec.data?.data?.structured_content?.map(c => c.text).join('\n'),
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'uploads';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Document',
      type,
      name: rec.filename,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        filetype: rec.data?.metadata?.filetype,
      },
    };
  },

  workspaces: (rec) => {
    const texts = [
      rec.name,
      rec.description,
    ];
    const text = texts.filter(t => t).join('\n');
    const type = 'workspaces';
    return {
      id: type + ':' + rec.id,
      nodeLabel: 'Object',
      label: 'Workspaces',
      type,
      name: rec.name,
      key: rec.key,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      isPublic: rec.isPublic,
      metadata: {
      },
    };
  }

}