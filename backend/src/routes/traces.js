import { default as dayjs } from 'dayjs';
import uuid from 'uuid';

import { TracingCallback } from '../core/callbacks/TracingCallback';

export default ({ app, auth, logger, services }) => {

  const { tracesService } = services;

  const traces = {};

  app.get('/api/workspaces/:workspaceId/traces', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { limit, start, name, created, success, latency } = req.query;
    let filters = { ...req.query };
    delete filters.limit;
    delete filters.start;
    delete filters.name;
    delete filters.created;
    delete filters.success;
    delete filters.latency;
    filters = Object.entries(filters).reduce((a, [k, v]) => {
      if (Array.isArray(v)) {
        if (v[0] === 'true' || v[0] === 'false') {
          a[k] = v.map(x => x === 'true');
        } else {
          a[k] = v;
        }
      } else if (v) {
        a[k] = v;
      }
      return a;
    }, {});
    logger.debug('filters:', filters);
    let nameQuery;
    if (name) {
      nameQuery = name[0];
    }
    let startDate, endDate;
    if (created) {
      startDate = created[0][0];
      endDate = created[0][1];
    }
    let minLatency, maxLatency;
    if (latency) {
      minLatency = +latency[0][0];
      maxLatency = +latency[0][1];
    }
    const count = await tracesService.getTracesCount(workspaceId, filters, nameQuery, startDate, endDate, success, minLatency, maxLatency);
    const traces = await tracesService.getTraces(workspaceId, limit, start, filters, nameQuery, startDate, endDate, success, minLatency, maxLatency);
    res.json({ count, data: traces });
  });

  const getModel = (trace) => {
    if (trace) {
      if (trace.type === 'call-model') {
        return trace.model;
      }
      const children = trace.children || [];
      for (const child of children) {
        const model = getModel(child);
        if (model) {
          return model;
        }
      }
    }
    return null;
  }

  app.get('/api/workspaces/:workspaceId/trace-analytics', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const traces = await tracesService.getTraces(workspaceId, 10000);
    const requestsByUser = traces.reduce((a, t) => {
      // TODO vision model calls may not be recording `createdBy`
      if (t.createdBy) {
        const date = dayjs(t.created).format('YYYY-MM-DD');
        if (!a[date]) {
          a[date] = {};
        }
        if (!a[date][t.createdBy]) {
          a[date][t.createdBy] = {};
        }
        const model = getModel(t.trace?.[0]) || 'undefined';
        if (!a[date][t.createdBy][model]) {
          a[date][t.createdBy][model] = {
            requests: 0,
            tokens: 0,
          };
        }
        a[date][t.createdBy][model].requests += 1;
        a[date][t.createdBy][model].tokens += t.trace?.[0]?.response?.usage?.total_tokens;
      }
      return a;
    }, {});
    res.json({
      requestsByUser,
    });
  });

  app.get('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    let trace;
    if (id === 'latest') {
      trace = await tracesService.getLatestTrace();
    } else {
      trace = await tracesService.getTrace(id);
    }
    // logger.debug('trace:', trace);
    res.json(trace);
  });

  app.post('/api/traces', auth, async (req, res, next) => {
    const { username } = req.user;
    let { event, id, userId, workspaceId } = req.body;
    id ||= uuid.v4();
    const { type } = event;
    logger.debug('type:', type, id);
    userId ||= username;
    const callback = traces[id];
    if (type === 'trace') {
      logger.debug('Create TracingCallback');
      const callback = new TracingCallback({
        tracesService,
        username,
        workspaceId: +workspaceId,
        debug: true,
      });
      traces[id] = callback;
    } else if (type === 'agent-start') {
      const {
        args,
        extra_function_call_params,
        model,
        llm_params,
        tools,
      } = event;
      const name = event.name || event.type + ' - ' + new Date().toISOString();
      callback.onAgentStart({
        allowedTools: tools,
        args,
        extraFunctionCallParams: extra_function_call_params,
        model,
        modelParams: llm_params,
        name,
      });
    } else if (type === 'agent-end') {
      const { response } = event;
      callback.onAgentEnd({
        response,
      });
    } else if (type === 'prompt-template-start') {
      const { args, message_templates, prompt_set_name, prompt_set_version } = event;
      callback.onPromptTemplateStart({
        args,
        messageTemplates: message_templates,
        promptSetName: prompt_set_name,
        promptSetVersion: prompt_set_version,
      });
    } else if (type === 'prompt-template-end') {
      const { messages } = event;
      callback.onPromptTemplateEnd({
        messages,
      });
    } else if (type === 'model-start') {
      const { llm_params, provider, request } = event;
      callback.onModelStart({
        modelParams: llm_params,
        provider,
        request,
      });
    } else if (type === 'model-end') {
      const { response, output } = event;
      callback.onModelEnd({
        response,
        output,
      });
    } else if (type === 'tool-start') {
      const { call } = event;
      callback.onFunctionCallStart({
        name: call.name,
        args: call.arguments,
      });
    } else if (type === 'tool-end') {
      const { response, output } = event;
      callback.onFunctionCallEnd({
        response,
        output,
      });
    }
    res.json(id);
  });

  app.put('/api/traces/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    const trace = await tracesService.upsertTrace({ ...values, id }, username);
    res.json(trace);
  });

  app.delete('/api/traces/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await tracesService.deleteTraces([id]);
    res.json(id);
  });

  app.delete('/api/traces', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',').map(id => +id);
    await tracesService.deleteTraces(ids);
    res.json(ids);
  });

};
