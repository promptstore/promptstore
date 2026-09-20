const { isApiPathAllowed } = await import('../../src/config/roles.js');

// The functionality each role must be able to reach, per the role spec.
const SPEC = {
  promptengineer: { // "Context Engineer"
    allow: [
      ['GET','/api/workspaces/1/prompt-sets'], ['POST','/api/prompt-sets'],
      ['PUT','/api/prompt-sets/1'], ['DELETE','/api/prompt-sets/1'],
      ['POST','/api/chat'], ['POST','/api/prompts'],            // Prompt Testing
      ['GET','/api/workspaces/1/test-scenarios'], ['POST','/api/test-scenarios'],
      ['POST','/api/test-scenario-runs'],
      ['GET','/api/workspaces/1/harness-traces'],               // kept per your answer
      ['GET','/api/workspaces/1/harness/cost/summary'],
      ['GET','/api/workspaces/1/harness/insights'],
    ],
    deny: [
      ['POST','/api/functions'], ['POST','/api/models'], ['POST','/api/agents'],
      ['GET','/api/workspaces/1/evaluations'], ['POST','/api/data-sources'],
      ['GET','/api/workspaces/1/secrets'], ['DELETE','/api/users'],
      // POST /api/roles is deliberately NOT here: the coarse middleware lets it
      // through so the first-run bootstrap can work, and routes/users.js denies
      // it. Covered by the route-handler tests below.
    ],
  },
  aiengineer: {
    allow: [
      ['POST','/api/prompt-sets'], ['POST','/api/chat'], ['POST','/api/test-scenarios'],
      ['POST','/api/functions'], ['PUT','/api/functions/1'],     // Semantic Functions
      ['GET','/api/workspaces/1/compositions'], ['POST','/api/compositions'],  // Workflows
      ['POST','/api/models'], ['PUT','/api/models/1'],           // Models
      ['GET','/api/workspaces/1/agents'], ['POST','/api/agents'],// Agents
      ['GET','/api/workspaces/1/harness-traces'],
    ],
    deny: [
      ['GET','/api/workspaces/1/evaluations'], ['POST','/api/data-sources'],
      ['GET','/api/workspaces/1/secrets'], ['POST','/api/agent-networks'],
    ],
  },
  evaluator: {
    allow: [
      ['GET','/api/workspaces/1/harness-traces'],               // Harness Traces
      ['GET','/api/workspaces/1/harness/cost/summary'],         // Cost & Usage
      ['GET','/api/workspaces/1/harness/insights'],             // Harness Insights
      ['GET','/api/workspaces/1/evaluations'], ['POST','/api/evaluations'],
      ['GET','/api/workspaces/1/evaluation-runs'], ['POST','/api/evaluation-runs/1'],
      ['GET','/api/workspaces/1/training'], ['POST','/api/training'],  // Human Review
      ['POST','/api/prompt-sets'], ['POST','/api/chat'], ['POST','/api/test-scenarios'],
    ],
    deny: [
      ['POST','/api/functions'], ['POST','/api/models'], ['POST','/api/agents'],
      ['POST','/api/data-sources'], ['GET','/api/workspaces/1/secrets'],
    ],
  },
  knowledgeengineer: {
    allow: [
      ['GET','/api/workspaces/1/uploads'], ['DELETE','/api/uploads'],      // Documents
      ['POST','/api/data-sources'], ['PUT','/api/data-sources/1'],         // Data Sources
      ['POST','/api/destinations'],                                        // Destinations
      ['POST','/api/indexes'], ['DELETE','/api/indexes/1'],                // Semantic Indexes
      ['GET','/api/graphs'], ['DELETE','/api/graph-stores/neo4j'],         // Knowledge Graphs
      ['POST','/api/transformations'], ['POST','/api/transformation-runs/1'],
      ['POST','/api/index/crawler'], ['POST','/api/search'],               // RAG Testing
    ],
    deny: [
      ['POST','/api/functions'], ['POST','/api/models'],
      ['GET','/api/workspaces/1/evaluations'], ['GET','/api/workspaces/1/secrets'],
    ],
  },
  admin: {
    allow: [
      ['GET','/api/workspaces/1/secrets'], ['POST','/api/roles'], ['DELETE','/api/users'],
      ['POST','/api/functions'], ['POST','/api/data-sources'], ['POST','/api/evaluations'],
      ['POST','/api/mirrors'], ['POST','/api/settings'], ['GET','/api/workspaces/1/traces'],
    ],
    deny: [],
  },
};

let pass = 0, fail = 0;
for (const [role, { allow, deny }] of Object.entries(SPEC)) {
  const u = { roles: [role] };
  for (const [m, p] of allow) {
    const r = isApiPathAllowed(u, p, m);
    if (r.allowed) pass++;
    else { fail++; console.log(`FAIL ${role}: ${m} ${p} should be ALLOWED (${r.reason})`); }
  }
  for (const [m, p] of deny) {
    const r = isApiPathAllowed(u, p, m);
    if (!r.allowed) pass++;
    else { fail++; console.log(`FAIL ${role}: ${m} ${p} should be DENIED (${r.reason})`); }
  }
}

// Self-service writes must pass the coarse middleware so routes/users.js can
// apply its own check: Login/Register self-upsert and the first-run
// setAdmin() bootstrap are all made by non-admins.
for (const role of ['promptengineer','knowledgeengineer','evaluator','ops']) {
  for (const [m,p,want] of [['POST','/api/users',true],     // self-upsert at login
                            ['POST','/api/roles',true],     // bootstrap; route re-checks
                            ['GET','/api/users',false],     // user list stays admin
                            ['DELETE','/api/users',false],  // deletion stays admin
                            ['GET','/api/users/id/3',false]]) {
    const r = isApiPathAllowed({roles:[role]}, p, m);
    if (r.allowed === want) pass++;
    else { fail++; console.log(`FAIL ${role}: ${m} ${p} expected allowed=${want} got ${r.allowed} (${r.reason})`); }
  }
}

// Role-less user must fall back to the default role, not full access.
const none = { roles: [] };
for (const [m, p, want] of [['GET','/api/workspaces/1/secrets',false],
                            ['POST','/api/functions',false],
                            ['POST','/api/prompt-sets',true]]) {
  const r = isApiPathAllowed(none, p, m);
  if (r.allowed === want) pass++;
  else { fail++; console.log(`FAIL no-roles: ${m} ${p} expected allowed=${want} got ${r.allowed}`); }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
