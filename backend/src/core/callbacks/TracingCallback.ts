import { default as dayjs } from 'dayjs';
import { ValidatorResult } from 'jsonschema';
import uuid from 'uuid';

import logger from '../../logger';

import {
  AgentOnStartResponse,
  AgentOnEndResponse,
} from '../../agents/Agent_types';
import { MapArgumentsResponse, MapReturnTypeResponse } from '../common_types';
import {
  CompositionOnStartResponse,
  CompositionOnEndResponse,
} from '../compositions/Composition_types';
import {
  InputGuardrailsOnEndResponse,
  InputGuardrailsOnStartResponse,
} from '../guardrails/InputGuardrails_types';
import {
  CustomModelOnStartResponse,
  CustomModelOnEndResponse,
} from '../models/custom_model_types';
import {
  HuggingfaceModelOnStartResponse,
  HuggingfaceModelOnEndResponse,
} from '../models/huggingface_types';
import {
  CacheResponse,
  ModelOnStartResponse,
  ModelOnEndResponse,
} from '../models/llm_types';
import {
  OutputProcessingResponse,
  OutputGuardrailStartResponse,
  OutputParserStartResponse,
} from '../outputprocessing/OutputProcessingPipeline_types';
import {
  PromptEnrichmentOnStartResponse,
  PromptEnrichmentOnEndResponse,
  FeatureStoreEnrichmentOnStartResponse,
  FeatureStoreEnrichmentOnEndResponse,
  SemanticSearchEnrichmentOnStartResponse,
  SemanticSearchEnrichmentOnEndResponse,
  FunctionEnrichmentOnStartResponse,
  FunctionEnrichmentOnEndResponse,
  SqlEnrichmentOnStartResponse,
  SqlEnrichmentOnEndResponse,
  GraphEnrichmentOnStartResponse,
  GraphEnrichmentOnEndResponse,
} from '../promptenrichment/PromptEnrichmentPipeline_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../promptenrichment/PromptTemplate_types';
import {
  SemanticFunctionImplementationOnStartResponse,
  SemanticFunctionImplementationOnEndResponse,
} from '../semanticfunctions/SemanticFunctionImplementation_types';
import {
  ExperimentResponse,
  SemanticFunctionOnStartResponse,
  SemanticFunctionOnEndResponse,
} from '../semanticfunctions/SemanticFunction_types';
import { Tracer } from '../tracing/Tracer';
import { TraceCallbackParams } from '../tracing/Tracer_types';

import { Callback } from './Callback';

export class TracingCallback extends Callback {

  isComposition: boolean;
  tracer: Tracer;
  startTime: Date[];
  workspaceId: number;
  username: string;
  tracesService: any;
  callDepth: number;
  debug: boolean;

  constructor({ workspaceId, username, tracesService, tracer, debug }: TraceCallbackParams) {
    super();
    logger.debug(`Constructing TracingCallback [debug=${debug}]`);
    this.workspaceId = workspaceId;
    this.username = username;
    this.tracesService = tracesService;
    this.tracer = tracer;
    this.startTime = [];
    this.callDepth = 0;
    this.debug = debug;
  }

  clone() {
    return new TracingCallback({
      workspaceId: this.workspaceId,
      username: this.username,
      tracesService: this.tracesService,
      tracer: this.tracer.clone(),
    });
  }

  onAgentStart(params: Partial<AgentOnStartResponse>) {
    const startTime = new Date();
    this.startTime.push(startTime);
    const { name, args, model, modelParams } = params;
    if (!this.tracer) {
      const traceName = [name, startTime.toISOString()].join(' - ');
      this.tracer = new Tracer(traceName, 'agent');
    }
    this.isComposition = true;
    this.callDepth += 1;
    const event = {
      id: uuid.v4(),
      type: 'call-agent',
      function: name,
      model: {
        model: model,
        modelParams,
      },
      args,
      startTime: startTime.getTime(),
    };
    if (this.debug) {
      logger.debug('onAgentStart:', event);
    }
    this.tracer
      .push(event)
      .down();
  }

  onAgentEnd({ errors, response }: AgentOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
    this.callDepth -= 1;
    if (this.debug) {
      logger.debug('onAgentEnd:', this.tracer.currentStep());
      logger.debug('callDepth:', this.callDepth);
    }
    if (this.callDepth === 0) {
      const traceRecord = this.tracer.close();
      logger.debug('traceRecord:', traceRecord);
      this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
    }
  }

  onAgentError(errors: any) {

  }

  onCompositionStart({ name, args, model, modelParams, isBatch }: CompositionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    if (!this.tracer) {
      const traceName = [name, startTime.toISOString()].join(' - ');
      this.tracer = new Tracer(traceName, 'composition');
    }
    this.isComposition = true;
    this.callDepth += 1;
    const event = {
      id: uuid.v4(),
      type: 'call-composition',
      function: name,
      model: {
        model: model,
        modelParams,
      },
      isBatch,
      args,
      startTime: startTime.getTime(),
    };
    if (this.debug) {
      logger.debug('onCompositionStart:', event);
    }
    this.tracer
      .push(event)
      .down();
  }

  onCompositionEnd({ response, errors }: CompositionOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
    if (this.debug) {
      logger.debug('onCompositionEnd:', this.tracer.currentStep());
    }
    this.callDepth -= 1;
    if (this.callDepth === 0) {
      const traceRecord = this.tracer.close();
      this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
    }
  }

  onCompositionError(errors: any) {
    if (this.debug) {
      logger.debug('onCompositionError:', errors);
    }
    this.tracer.push({
      type: 'error',
      errors,
    });
  }

  onSemanticFunctionStart({ name, args, history, model, modelParams, isBatch }: SemanticFunctionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    if (!this.tracer && !this.isComposition) {
      const traceName = [name, startTime.toISOString()].join(' - ');
      this.tracer = new Tracer(traceName);
    }
    this.callDepth += 1;
    const event = {
      id: uuid.v4(),
      type: 'call-function',
      function: name,
      implementation: {
        model: model,
        modelParams,
      },
      isBatch,
      args,
      history,
      startTime: startTime.getTime(),
    };
    if (this.debug) {
      logger.debug('onSemanticFunctionStart:', event);
    }
    this.tracer
      .push(event)
      .down();
  }

  onSemanticFunctionEnd({ response, errors }: SemanticFunctionOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
    if (this.debug) {
      logger.debug('onSemanticFunctionEnd:', this.tracer.currentStep());
    }
    this.callDepth -= 1;
    if (this.callDepth === 0 && !this.isComposition) {
      const traceRecord = this.tracer.close();
      this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
    }
  }

  onSemanticFunctionError(errors: any) {
    if (this.debug) {
      logger.debug('onSemanticFunctionError:', errors);
    }
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onValidateArguments(validatorResult: ValidatorResult) {
    const event = {
      id: uuid.v4(),
      type: 'validate-args',
      instance: validatorResult.instance,
      schema: validatorResult.schema,
      valid: validatorResult.valid,
      errors: validatorResult.errors,
    };
    if (this.debug) {
      logger.debug('onValidateArguments:', event);
    }
    this.tracer.push(event);
  }

  onMapArguments({ args, mapped, mappingTemplate, isBatch, source, errors }: MapArgumentsResponse) {
    if (isBatch) {
      this.tracer.push({
        id: uuid.v4(),
        type: 'map-args',
        input: args?.length ? args[0] : args,
        output: mapped?.length ? mapped[0] : mapped,
        isBatch,
        mappingTemplate,
        source,
        errors,
      });
    } else {
      this.tracer.push({
        id: uuid.v4(),
        type: 'map-args',
        input: args,
        output: mapped,
        isBatch,
        mappingTemplate,
        source,
        errors,
      });
    }
    if (this.debug) {
      logger.debug('onMapArguments:', this.tracer.currentStep());
    }
  }

  onMapReturnType({ response, mapped, mappingTemplate, isBatch, errors }: MapReturnTypeResponse) {
    if (isBatch) {
      this.tracer.push({
        id: uuid.v4(),
        type: 'map-response',
        input: response?.length ? response[0] : response,
        output: mapped?.length ? mapped[0] : mapped,
        isBatch,
        mappingTemplate,
      });
    } else {
      this.tracer.push({
        id: uuid.v4(),
        type: 'map-response',
        input: response,
        output: mapped,
        isBatch,
        mappingTemplate,
        errors,
      });
      if (this.debug) {
        logger.debug('onMapReturnType:', this.tracer.currentStep());
      }
    }
  }

  onExperiment({ experiments, implementation }: ExperimentResponse) {
    const event = {
      id: uuid.v4(),
      type: 'select-experiment',
      experiments,
      implementation,
    };
    if (this.debug) {
      logger.debug('onExperiment:', event);
    }
    this.tracer.push(event);
  }

  onSemanticFunctionImplementationStart({ args, history, modelType, model, modelParams, isBatch }: SemanticFunctionImplementationOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    const event = {
      id: uuid.v4(),
      type: 'call-implementation',
      implementation: {
        modelType,
        model: model,
        modelParams,
      },
      isBatch,
      args,
      history,
      startTime: startTime.getTime(),
    };
    if (this.debug) {
      logger.debug('onSemanticFunctionImplementationStart:', event);
    }
    this.tracer
      .push(event)
      .down();
  }

  onSemanticFunctionImplementationEnd({ response, errors }: SemanticFunctionImplementationOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
    if (this.debug) {
      logger.debug('onSemanticFunctionImplementationEnd:', this.tracer.currentStep());
    }
  }

  onSemanticFunctionImplementationError(errors: any) {
    if (this.debug) {
      logger.debug('onSemanticFunctionImplementationError:', errors);
    }
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onBatchBinStart(params) {
    logger.debug('!! onBatchBinStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'batch-bin',
        startTime: startTime.getTime(),
        ...params,
      })
      .down();
  }

  onBatchBinEnd({ errors }) {
    logger.debug('!! onBatchBinEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('success', true)
        ;
    }
  }

  onPromptEnrichmentStart({ args, isBatch }: PromptEnrichmentOnStartResponse) {
    logger.debug('!! onPromptEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'enrichment-pipeline',
        args,
        isBatch,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onPromptEnrichmentEnd({ messages, errors }: PromptEnrichmentOnEndResponse) {
    logger.debug('!! onPromptEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('messages', messages)
        .addProperty('success', true)
        ;
    }
  }

  onPromptEnrichmentError(errors: any) {
    logger.debug('!! onPromptEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onFeatureStoreEnrichmentStart({ args, isBatch, featureStore }: FeatureStoreEnrichmentOnStartResponse) {
    logger.debug('!! onFeatureStoreEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'feature-store-enrichment',
        featureStore,
        args,
        isBatch,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onFeatureStoreEnrichmentEnd({ enrichedArgs, errors }: FeatureStoreEnrichmentOnEndResponse) {
    logger.debug('!! onFeatureStoreEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('enrichedArgs', enrichedArgs)
        .addProperty('success', true)
        ;
    }
  }

  onFeatureStoreEnrichmentError(errors: any) {
    logger.debug('!! onFeatureStoreEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onSemanticSearchEnrichmentStart({ args, isBatch, index }: SemanticSearchEnrichmentOnStartResponse) {
    logger.debug('!! onSemanticSearchEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'semantic-search-enrichment',
        index,
        args,
        isBatch,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onSemanticSearchEnrichmentEnd({ enrichedArgs, sources, errors }: SemanticSearchEnrichmentOnEndResponse) {
    logger.debug('!! onSemanticSearchEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('enrichedArgs', enrichedArgs)
        .addProperty('sources', sources)
        .addProperty('success', true)
        ;
    }
  }

  onSemanticSearchEnrichmentError(errors: any) {
    logger.debug('!! onSemanticSearchEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onFunctionEnrichmentStart({ args, functionName, model, modelParams, contentPropertyPath, contextPropertyPath }: FunctionEnrichmentOnStartResponse) {
    logger.debug('!! onFunctionEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'function-enrichment',
        functionName,
        model,
        modelParams,
        contentPropertyPath,
        contextPropertyPath,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onFunctionEnrichmentEnd({ enrichedArgs, errors }: FunctionEnrichmentOnEndResponse) {
    logger.debug('!! onFunctionEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('enrichedArgs', enrichedArgs)
        .addProperty('success', true)
        ;
    }
  }

  onFunctionEnrichmentError(errors: any) {
    logger.debug('!! onFunctionEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onSqlEnrichmentStart({ args }: SqlEnrichmentOnStartResponse) {
    logger.debug('!! onSqlEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'sql-enrichment',
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onSqlEnrichmentEnd({ enrichedArgs, errors }: SqlEnrichmentOnEndResponse) {
    logger.debug('!! onSqlEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('enrichedArgs', enrichedArgs)
        .addProperty('success', true)
        ;
    }
  }

  onSqlEnrichmentError(errors: any) {
    logger.debug('!! onSqlEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onGraphEnrichmentStart({ args }: GraphEnrichmentOnStartResponse) {
    logger.debug('!! onGraphEnrichmentStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'graph-enrichment',
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onGraphEnrichmentEnd({ enrichedArgs, errors }: GraphEnrichmentOnEndResponse) {
    logger.debug('!! onGraphEnrichmentEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('enrichedArgs', enrichedArgs)
        .addProperty('success', true)
        ;
    }
  }

  onGraphEnrichmentError(errors: any) {
    logger.debug('!! onGraphEnrichmentError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onPromptTemplateStart({ args, isBatch, messageTemplates, promptSetId, promptSetName, promptSetVersion }: PromptTemplateOnStartResponse) {
    logger.debug('!! onPromptTemplateStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messageTemplates,
        args,
        isBatch,
        startTime: startTime.getTime(),
        promptSetId,
        promptSetName,
        promptSetVersion,
      })
      .down();
  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {
    logger.debug('!! onPromptTemplateEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('messages', messages)
        .addProperty('success', true)
        ;
    }
  }

  onPromptTemplateError(errors: any) {
    logger.debug('!! onPromptTemplateError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors: errors,
    });
  }

  onInputGuardrailStart({ guardrails, messages }: InputGuardrailsOnStartResponse) {
    logger.debug('!! onInputGuardrailStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'check-input-guardrails',
        guardrails,
        messages,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onInputGuardrailEnd({ valid, errors }: InputGuardrailsOnEndResponse) {
    logger.debug('!! onInputGuardrailEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      .addProperty('valid', valid)
      ;
    if (errors) {
      this.tracer.addProperty('errors', errors);
    }
  }

  onInputGuardrailError(errors: any) {
    logger.debug('!! onInputGuardrailError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors: errors,
    });
  }

  onModelStart({ modelId, modelName, modelParams, provider, request }: ModelOnStartResponse) {
    logger.debug('!! onModelStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        modelId,
        modelName,
        provider,
        ...request,
        modelParams,
        type: 'call-model',
        startTime: startTime.getTime(),
      })
      .down();
  }

  onLookupCache({ model, prompt, hit, response }: CacheResponse) {
    logger.debug('!! onLookupCache');
    this.tracer.push({
      id: uuid.v4(),
      type: 'lookup-cache',
      model,
      prompt,
      hit,
      response,
    });
  }

  onModelEnd({ errors, response }: ModelOnEndResponse) {
    logger.debug('!! onModelEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onModelError(errors: any) {
    logger.debug('!! onModelError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onCompletionModelStart({ request }: ModelOnStartResponse) {
    logger.debug('!! onCompletionModelStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        ...request,
        type: 'call-model',
        startTime: startTime.getTime(),
      })
      .down();
  }

  onCompletionModelEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('!! onCompletionModelEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onCompletionModelError(errors: any) {
    logger.debug('!! onCompletionModelError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onCustomModelStart({ args, isBatch, model, url }: CustomModelOnStartResponse) {
    logger.debug('!! onCustomModelStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-custom-model',
        model,
        url,
        args,
        isBatch,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onCustomModelEnd({ response, errors }: CustomModelOnEndResponse) {
    logger.debug('!! onCustomModelEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onCustomModelError(errors: any) {
    logger.debug('!! onCustomModelError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onHuggingfaceModelStart({ args, model }: HuggingfaceModelOnStartResponse) {
    logger.debug('!! onHuggingfaceModelStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-huggingface-model',
        model,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onHuggingfaceModelEnd({ response, errors }: HuggingfaceModelOnEndResponse) {
    logger.debug('!! onHuggingfaceModelEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onHuggingfaceModelError(errors: any) {
    logger.debug('!! onHuggingfaceModelError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputProcessingStart({ response }: OutputProcessingResponse) {
    logger.debug('!! onOutputProcessingStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'output-processing-pipeline',
        input: response,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onOutputProcessingEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('!! onOutputProcessingEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('response', response)
        .addProperty('success', true)
        ;
    }
  }

  onOutputProcessingError(errors: any) {
    logger.debug('!! onOutputProcessingError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputGuardrailStart({ guardrail, response }: OutputGuardrailStartResponse) {
    logger.debug('!! onOutputGuardrailStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'output-guardrail',
        guardrail,
        input: response,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onOutputGuardrailEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('!! onOutputGuardrailEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('output', response)
        .addProperty('success', true)
        ;
    }
  }

  onOutputGuardrailError(errors: any) {
    logger.debug('!! onOutputGuardrailError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputParserStart({ outputParser, response }: OutputParserStartResponse) {
    logger.debug('!! onOutputParserStart');
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'output-parser',
        outputParser,
        input: response,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onOutputParserEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('!! onOutputParserEnd');
    const startTime = this.startTime.pop();
    const endTime = new Date();
    this.tracer
      .up()
      .addProperty('endTime', endTime.getTime())
      .addProperty('elapsedMillis', endTime.getTime() - startTime.getTime())
      .addProperty('elapsedReadable', dayjs(endTime).from(startTime))
      ;
    if (errors) {
      this.tracer
        .addProperty('errors', errors)
        .addProperty('success', false)
        ;
    } else {
      this.tracer
        .addProperty('output', response)
        .addProperty('success', true)
        ;
    }
  }

  onOutputParserError(errors: any) {
    logger.debug('!! onOutputParserError');
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

}
