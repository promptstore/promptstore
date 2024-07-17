import uuid from 'uuid';

import searchFunctions from '../searchFunctions';

export default ({ app, auth, constants, logger, services, workflowClient }) => {

  const OBJECT_TYPE = 'agent-networks';

  const { agentNetworksService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  // cache of results to poll
  const jobs = {};

  app.get('/api/agent-network-status/:correlationId', auth, async (req, res) => {
    const { correlationId } = req.params;
    // logger.debug('checking upload status for:', correlationId);
    const result = jobs[correlationId];
    if (!result) {
      return res.sendStatus(423);
    }
    res.json(result);
    delete jobs[correlationId];
  });

  app.get('/api/workspaces/:workspaceId/agent-networks', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const agentNetworks = await agentNetworksService.getAgentNetworks(workspaceId);
    res.json(agentNetworks);
  });

  app.get('/api/agent-networks/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const agentNetwork = await agentNetworksService.getAgentNetwork(id);
    res.json(agentNetwork);
  });

  app.post('/api/agent-networks', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    let agentNetwork = await agentNetworksService.upsertAgentNetwork(values, username);
    const obj = createSearchableObject(agentNetwork);
    const chunkId = await indexObject(obj, agentNetwork.chunkId);
    if (!agentNetwork.chunkId) {
      agentNetwork = await agentNetworksService.upsertRule({ ...agentNetwork, chunkId }, username);
    }
    res.json(agentNetwork);
  });

  app.put('/api/agent-networks/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    let agentNetwork = await agentNetworksService.upsertAgentNetwork({ id, ...values }, username);
    const obj = createSearchableObject(agentNetwork);
    const chunkId = await indexObject(obj, agentNetwork.chunkId);
    if (!agentNetwork.chunkId) {
      agentNetwork = await agentNetworksService.upsertAgentNetwork({ ...agentNetwork, chunkId }, username);
    }
    res.json(agentNetwork);
  });

  app.delete('/api/agent-networks/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await agentNetworksService.deleteAgentNetworks([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/agent-networks', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await agentNetworksService.deleteAgentNetworks(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
  });

  app.post('/api/agent-network-runs', auth, async (req, res, next) => {
    const { username } = req.user;
    const { agentNetworkId, correlationId } = req.body;
    workflowClient.executeAgentNetwork({ agentNetworkId, username }, {
      address: constants.TEMPORAL_URL,
    })
      .then((result) => {
        // logger.debug('agent network result:', result);
        if (correlationId) {
          jobs[correlationId] = result;
        }

        // allow 10m to poll for results
        setTimeout(() => {
          delete jobs[correlationId];
        }, 10 * 60 * 1000);
      });

    res.sendStatus(200);
  });

  const objectId = (id) => OBJECT_TYPE + ':' + id;

  function createSearchableObject(rec) {
    const texts = [
      rec.name,
    ];
    const text = texts.filter(t => t).join('\n');
    return {
      id: objectId(rec.id),
      nodeLabel: 'Object',
      label: 'AgentNetwork',
      type: OBJECT_TYPE,
      name: rec.name,
      text,
      createdDateTime: rec.created,
      createdBy: rec.createdBy,
      workspaceId: String(rec.workspaceId),
      metadata: {
        type: rec.type,
      },
    };
  }

};
