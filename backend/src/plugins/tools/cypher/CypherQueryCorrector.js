import trim from 'lodash.trim';

export const createCypherQueryCorrector = (schemas) => {

  const propertyPattern = /\{.+?\}/g;
  const nodePattern = /\(.+?\)/g;
  const pathPattern = /\(.*\).*-.*-.*\(.*\)/g;
  const nodeRelationNodePattern = /(\()+(?<leftNode>[^()]*?)\)(?<relation>.*?)\((?<rightNode>[^()]*?)(\))+/g;
  const relationTypePattern = /:(?<relationType>.+?)?(\{.+\})?]/;

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

  const verifySchema = (fromNodeLabels, relationTypes, toNodeLabels) => {
    console.log('fromNodeLabels:', fromNodeLabels)
    console.log('relationTypes:', relationTypes)
    console.log('toNodeLabels:', toNodeLabels)
    console.log('schemas:', schemas)
    return schemas.some(schema =>
      (!fromNodeLabels.length || fromNodeLabels.map(label => trim(label, '`')).includes(schema[0])) &&
      (!toNodeLabels.length || toNodeLabels.map(label => trim(label, '`')).includes(schema[2])) &&
      (!relationTypes.length || relationTypes.map(type => trim(type, '`')).includes(schema[1]))
    );
  }

  const detectRelationTypes = (strRelation) => {
    const direction = judgeDirection(strRelation);
    const match = relationTypePattern.exec(strRelation).groups;
    const types = match && match.relationType ? match.relationType.split('|').map(t => trim(t.trim(), '!')) : [];
    return [direction, types];
  };

  const correctQuery = (query) => {
    console.log('original query:', query);
    /* e.g.
     * `cypher
     *  MATCH (p:Person)-[:LEDBY]->(o:Organization {name: "The Walt Disney Company"})
     *  RETURN p.name AS LeaderName`
     */

    // e.g. `{ p: [ 'Person' ], o: [ 'Organization' ] }`
    const nodeVariables = detectNodeVariables(query);

    // e.g. `['(p:Person)-[:LEDBY]->(o:Organization {name: "The Walt Disney Company"})']`
    const paths = extractPaths(query);

    return paths.reduce((updatedQuery, path) => {
      let startIdx = 0;

      while (startIdx < path.length) {
        const matchRes = nodeRelationNodePattern.exec(path.slice(startIdx));
        if (!matchRes) break;

        startIdx += matchRes.index;
        const groups = matchRes.groups;
        const leftNode = groups.leftNode;
        const relation = groups.relation;
        const rightNode = groups.rightNode;

        const leftNodeLabels = detectLabels(leftNode, nodeVariables);
        const rightNodeLabels = detectLabels(rightNode, nodeVariables);

        const endIdx = startIdx + 4 + leftNode.length + relation.length + rightNode.length;

        // e.g. `(p:Person)-[:LEDBY]->(o:Organization {name: "The Walt Disney Company"})`
        const originalPartialPath = path.slice(startIdx, endIdx + 1);
        console.log('original partial path:', originalPartialPath);

        const [relationDirection, relationTypes] = detectRelationTypes(relation);
        console.log('relation direction:', relationDirection);
        console.log('relation types:', relationTypes);

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
        console.log('corrected relation:', correctedRelation);

        if (isLegal) {
          const correctedPartialPath = originalPartialPath.replace(relation, correctedRelation);
          console.log('corrected partial path:', correctedPartialPath);

          updatedQuery = updatedQuery.replace(originalPartialPath, correctedPartialPath);
          console.log('updated query:', updatedQuery);
        } else {
          return '';
        }

        startIdx += leftNode.length + relation.length + 2;
      }
      console.log('final updated query:', updatedQuery);

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
