import trim from 'lodash.trim';

export const createCypherQueryCorrector = (schemas) => {

  const propertyPattern = /\{.+?\}/g;
  const nodePattern = /\(.+?\)/g;
  const pathPattern = /\(.*\).*-.*-.*\(.*\)/g;
  const nodeRelationNodePattern = /(\()+([^()]*?)\)(.*?)\(([^()]*?)(\))+/g;
  const relationTypePattern = /:(.+?)?(\{.+\})?]/;

  const cleanNode = (node) =>
    node.replace(propertyPattern, '').replace(/[()]/g, '').trim();

  const detectNodeVariables = (query) =>
    [...query.matchAll(nodePattern)]
      .map(match => cleanNode(match[0]))
      .reduce((res, node) => {
        const [variable, ...labels] = node.split(':');
        if (!variable) return res;
        res[variable] = (res[variable] || []).concat(labels);
        return res;
      }, {});

  const extractPaths = (query) =>
    [...query.matchAll(pathPattern)].map(match => match[0]);

  const judgeDirection = (relation) =>
    relation[0] === '<' ? 'INCOMING' : relation[relation.length - 1] === '>' ? 'OUTGOING' : 'BIDIRECTIONAL';

  const extractNodeVariable = (part) => {
    const cleanedPart = part.replace(/[()]/g, '');
    const idx = cleanedPart.indexOf(':');
    return idx !== -1 ? cleanedPart.substring(0, idx) : (cleanedPart || null);
  };

  const detectLabels = (strNode, nodeVariables) => {
    const [variable, ...labels] = strNode.split(':');
    return nodeVariables[variable] || (variable ? labels : []);
  };

  const verifySchema = (fromNodeLabels, relationTypes, toNodeLabels) =>
    schemas.some(schema =>
      (!fromNodeLabels.length || fromNodeLabels.map(label => trim(label, '`')).includes(schema[0])) &&
      (!toNodeLabels.length || toNodeLabels.map(label => trim(label, '`')).includes(schema[2])) &&
      (!relationTypes.length || relationTypes.map(type => trim(type, '`')).includes(schema[1]))
    );

  const detectRelationTypes = (strRelation) => {
    const direction = judgeDirection(strRelation);
    const match = strRelation.match(relationTypePattern);
    const types = match && match[1] ? match[1].split('|').map(t => trim(t.trim(), '!')) : [];
    return [direction, types];
  };

  const correctQuery = (query) => {
    const nodeVariables = detectNodeVariables(query);
    const paths = extractPaths(query);

    return paths.reduce((updatedQuery, path) => {
      let startIdx = 0;

      while (startIdx < path.length) {
        const matchRes = path.slice(startIdx).match(nodeRelationNodePattern);
        if (!matchRes) break;

        startIdx += matchRes.index;
        const leftNode = matchRes[2];
        const relation = matchRes[3];
        const rightNode = matchRes[4];

        const leftNodeLabels = detectLabels(leftNode, nodeVariables);
        const rightNodeLabels = detectLabels(rightNode, nodeVariables);

        const endIdx = startIdx + 4 + leftNode.length + relation.length + rightNode.length;
        const originalPartialPath = path.slice(startIdx, endIdx + 1);

        const [relationDirection, relationTypes] = detectRelationTypes(relation);

        if (relationTypes.length > 0 && relationTypes.join('').includes('*')) {
          startIdx += leftNode.length + relation.length + 2;
          continue;
        }

        let correctedRelation = relation;
        let isLegal = verifySchema(leftNodeLabels, relationTypes, rightNodeLabels);

        if (relationDirection === 'OUTGOING' && !isLegal) {
          isLegal = verifySchema(rightNodeLabels, relationTypes, leftNodeLabels);
          if (isLegal) correctedRelation = '<' + relation.slice(0, -1);
        } else if (relationDirection === 'INCOMING' && !isLegal) {
          isLegal = verifySchema(leftNodeLabels, relationTypes, rightNodeLabels);
          if (isLegal) correctedRelation = relation.slice(1) + '>';
        }

        if (isLegal) {
          const correctedPartialPath = originalPartialPath.replace(relation, correctedRelation);
          updatedQuery = updatedQuery.replace(originalPartialPath, correctedPartialPath);
        } else {
          return '';
        }

        startIdx += leftNode.length + relation.length + 2;
      }

      return updatedQuery;
    }, query);
  };

  return {
    cleanNode,
    detectNodeVariables,
    extractPaths,
    judgeDirection,
    extractNodeVariable,
    detectLabels,
    verifySchema,
    detectRelationTypes,
    correctQuery,
    call: (query) => correctQuery(query),
  };
};
