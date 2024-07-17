import uuid from 'uuid';

import searchFunctions from '../searchFunctions';

const operatorMap = {
  'is': 'equal',
  'is_value': 'equal',
  'contains': 'equal',  // TODO
  'at_least': 'at_least',
  'equal': 'equal',
  'notEqual': 'notEqual',
  'lessThan': 'lessThan',
  'lessThanInclusive': 'lessThanInclusive',
  'greaterThan': 'greaterThan',
  'greaterThanInclusive': 'greaterThanInclusive',
  'before': 'before',
  'after': 'after',
  'within_last': 'within_last',
  'within': 'within',
  'following': 'following',
  'preceding': 'preceding',
};

export default ({ app, auth, constants, logger, services }) => {

  const OBJECT_TYPE = 'rules';

  const { rulesService, rulesEngineService } = services;

  const { deleteObjects, deleteObject, indexObject } = searchFunctions({ constants, logger, services });

  app.get('/api/workspaces/:workspaceId/rules', auth, async (req, res, next) => {
    const { workspaceId } = req.params;
    const { type } = req.query;
    let rules;
    if (type) {
      rules = await rulesService.getRulesByType(workspaceId, type);
    } else {
      rules = await rulesService.getRules(workspaceId);
    }
    res.json(rules);
  });

  app.get('/api/rules/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const rule = await rulesService.getRule(id);
    res.json(rule);
  });

  app.post('/api/rules/:id/deploy', auth, async (req, res, next) => {
    const { username } = req.user;
    const id = req.params.id;
    let { rulesetId } = req.body;
    let rule = await rulesService.getRule(id);
    const ast = rule.rules;
    const rules = convertAST([ast]);
    rulesetId ||= uuid.v4();
    await rulesEngineService.deployRules(rulesetId, rules);
    rule = await rulesService.upsertRule({ id, rulesetId }, username, true);
    res.json(rule);
  });

  app.post('/api/run-rules', auth, async (req, res, next) => {
    const data = req.body;
    const result = await rulesEngineService.run(data);
    // TODO
    res.json(result);
  });

  app.post('/api/rules', auth, async (req, res, next) => {
    const { username } = req.user;
    const values = req.body;
    let rule = await rulesService.upsertRule(values, username);
    const obj = createSearchableObject(rule);
    const chunkId = await indexObject(obj, rule.chunkId);
    if (!rule.chunkId) {
      rule = await rulesService.upsertRule({ ...rule, chunkId }, username);
    }
    res.json(rule);
  });

  app.put('/api/rules/:id', auth, async (req, res, next) => {
    const { id } = req.params;
    const { username } = req.user;
    const values = req.body;
    let rule = await rulesService.upsertRule({ id, ...values }, username);
    const obj = createSearchableObject(rule);
    const chunkId = await indexObject(obj, rule.chunkId);
    if (!rule.chunkId) {
      rule = await rulesService.upsertRule({ ...rule, chunkId }, username);
    }
    res.json(rule);
  });

  app.delete('/api/rules/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    await rulesService.deleteRules([id]);
    await deleteObject(objectId(id));
    res.json(id);
  });

  app.delete('/api/rules', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await rulesService.deleteRules(ids);
    await deleteObjects(ids.map(objectId));
    res.json(ids);
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
      label: 'Ruleset',
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

  const convertAST = (rules) => {
    logger.debug('convert rules:', rules);
    const ast = rules.reduce((a, r) => {
      a[r.logicalType_id] = r.predicates.map((p) => {
        if (p.logicalType_id) {
          return convertAST([p]);
        }
        const [fact, attr] = p.target_id.split('.');
        if ('event' === fact) {
          return {
            fact,
            operator: 'equal',
            value: 'true',
            path: '$.' + attr,
            key: p.key,
          };
        }
        return {
          fact,
          operator: operatorMap[p.operator_id],
          value: p.argument,
          path: '$.' + attr,
          key: p.key,
        };
      }).filter((p) => p.value !== null);
      return a;
    }, {});
    // console.log('return ast:', ast);
    return ast;
  };

};
