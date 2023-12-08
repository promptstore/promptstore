import React from 'react';

import { JsonView } from '../../../components/JsonView';
import { createOpenAIMessages } from '../../../utils/formats';

import { Agent } from './Agent';
import { AgentStepEvaluation } from './AgentStepEvaluation';
import { AgentTurn } from './AgentTurn';
import { CacheLookup } from './CacheLookup';
import { Chat } from './Chat';
import { CustomModelCall } from './CustomModelCall';
import { ExecutionUnit } from './ExecutionUnit';
import { Experiment } from './Experiment';
import { FunctionCall } from './FunctionCall';
import { Mapping } from './Mapping';
import { ModelCall } from './ModelCall';
import { Observation } from './Observation';
import { OutputGuardrail } from './OutputGuardrail';
import { OutputParser } from './OutputParser';
import { OutputProcessing } from './OutputProcessing';
import { PlanExecution } from './PlanExecution';
import { PlanModelCall } from './PlanModelCall';
import { PlanParse } from './PlanParse';
import { PromptEnrichment } from './PromptEnrichment';
import { PromptTemplate } from './PromptTemplate';
import { Validation } from './Validation';

export function Inspector({ step }) {
  switch (step.type) {
    case 'call-function':
      return <ExecutionUnit step={step} title="Call Function" />

    case 'call-implementation':
      return <ExecutionUnit step={step} title="Call Implementation" />

    case 'chat':
      return <Chat step={step} title="Chat" />

    case 'call-composition':
      return <ExecutionUnit step={step} title="Call Composition" />

    case 'validate-args':
      return <Validation step={step} title="Validate Args" />

    case 'map-args':
      return <Mapping step={step} title="Map Arguments" />

    case 'map-response':
      return <Mapping step={step} title="Map Response" />

    case 'enrichment-pipeline':
      return <PromptTemplate step={step} title="Enrichment Pipeline" />

    case 'call-prompt-template':
      return <PromptTemplate step={step} title="Call Prompt Template" />

    case 'call-model':
      let messages;
      if (step.model === 'gpt-4-vision-preview') {
        messages = step.messages;
      } else {
        messages = createOpenAIMessages(step.prompt);
      }
      return <ModelCall messages={messages} step={step} title="Call GPT Model" />

    case 'call-custom-model':
      return <CustomModelCall step={step} title="Call Custom Model" />

    case 'lookup-cache':
      return <CacheLookup step={step} title="Lookup Cache" />

    case 'plan-and-execute agent':
      return <Agent step={step} title="Plan and Execute" />

    case 'call-model: plan':
      return <PlanModelCall step={step} title="Call Model - Plan" />

    case 'execute-plan':
      return <PlanExecution step={step} title="Execute Plan" />

    case 'evaluate-step':
      return <AgentStepEvaluation step={step} title="Evaluate Step" />

    case 'evaluate-turn':
      return <AgentTurn step={step} title="Evaluate Turn" />

    case 'call-tool':
      return <FunctionCall step={step} title="Call Tool" />

    case 'call-model: observe':
      return <Observation step={step} title="Call Model - Observe" />

    case 'semantic-search-enrichment':
      return <PromptEnrichment step={step} title="Enrich Context using Semantic Search" />

    case 'feature-store-enrichment':
      return <PromptEnrichment step={step} title="Enrich Context using a Feature Store" />

    case 'function-enrichment':
      return <PromptEnrichment step={step} title="Enrich Context using a Semantic Function" />

    case 'sql-enrichment':
      return <PromptEnrichment step={step} title="Enrich Context using a SQL Source" />

    case 'graph-enrichment':
      return <PromptEnrichment step={step} title="Enrich Context using a Knowledge Graph Source" />

    case 'select-experiment':
      return <Experiment step={step} title="Select Experiment" />

    case 'parse-plan':
      return <PlanParse step={step} title="Parse Plan" />

    case 'output-processing-pipeline':
      return <OutputProcessing step={step} title="Process Output" />

    case 'output-parser':
      return <OutputParser step={step} title="Parse Output" />

    case 'output-guardrail':
      return <OutputGuardrail step={step} title="Apply Output Guardrail" />

    default:
      return <JsonView src={step} />
  }
}
