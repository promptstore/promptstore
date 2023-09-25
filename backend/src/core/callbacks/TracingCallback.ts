import { default as dayjs } from 'dayjs';
import { ValidatorResult } from 'jsonschema';
import uuid from 'uuid';

import logger from '../../logger';

import { MapArgumentsResponse, MapReturnTypeResponse } from '../common_types';
import {
  InputGuardrailsOnEndResponse,
  InputGuardrailsOnStartResponse,
} from '../guardrails/InputGuardrails_types';
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
} from '../promptenrichment/PromptEnrichmentPipeline_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from '../promptenrichment/PromptTemplate_types';
import {
  CacheResponse,
  ModelOnStartResponse,
  ModelOnEndResponse,
} from '../models/llm_types';
import {
  CustomModelOnStartResponse,
  CustomModelOnEndResponse,
} from '../models/custom_model_types';
import {
  HuggingfaceModelOnStartResponse,
  HuggingfaceModelOnEndResponse,
} from '../models/huggingface_types';
import {
  OutputProcessingResponse,
  OutputGuardrailStartResponse,
  OutputParserStartResponse,
} from '../outputprocessing/OutputProcessingPipeline_types';
import {
  SemanticFunctionImplementationOnStartResponse,
  SemanticFunctionImplementationOnEndResponse,
} from '../semanticfunctions/SemanticFunctionImplementation_types';
import {
  ExperimentResponse,
  SemanticFunctionOnStartResponse,
  SemanticFunctionOnEndResponse,
} from '../semanticfunctions/SemanticFunction_types';
import {
  CompositionOnStartResponse,
  CompositionOnEndResponse,
} from '../compositions/Composition_types';
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

  constructor({ workspaceId, username, tracesService }: TraceCallbackParams) {
    super();
    this.workspaceId = workspaceId;
    this.username = username;
    this.tracesService = tracesService;
    this.startTime = [];
  }

  onCompositionStart({ name, args, modelKey, modelParams, isBatch }: CompositionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    const traceName = [name, startTime.toISOString()].join(' - ');
    this.tracer = new Tracer(traceName, 'composition');
    this.isComposition = true;
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-composition',
        function: name,
        model: {
          model: modelKey,
          modelParams,
        },
        isBatch,
        args,
        startTime: startTime.getTime(),
      })
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
    const traceRecord = this.tracer.close();
    this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
  }

  onCompositionError(errors: any) {
    this.tracer.push({
      type: 'error',
      errors,
    });
  }

  onSemanticFunctionStart({ name, args, history, modelKey, modelParams, isBatch }: SemanticFunctionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    if (!this.isComposition) {
      const traceName = [name, startTime.toISOString()].join(' - ');
      this.tracer = new Tracer(traceName);
    }
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-function',
        function: name,
        implementation: {
          model: modelKey,
          modelParams,
        },
        isBatch,
        args,
        history,
        startTime: startTime.getTime(),
      })
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
    if (!this.isComposition) {
      const traceRecord = this.tracer.close();
      this.tracesService.upsertTrace({ ...traceRecord, workspaceId: this.workspaceId }, this.username);
    }
  }

  onSemanticFunctionError(errors: any) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onValidateArguments(validatorResult: ValidatorResult) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'validate-args',
      instance: validatorResult.instance,
      schema: validatorResult.schema,
      valid: validatorResult.valid,
      errors: validatorResult.errors,
    });
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
    }
  }

  onExperiment({ experiments, implementation }: ExperimentResponse) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'select-experiment',
      experiments,
      implementation,
    });
  }

  onSemanticFunctionImplementationStart({ args, history, modelType, modelKey, modelParams, isBatch }: SemanticFunctionImplementationOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-implementation',
        implementation: {
          modelType,
          model: modelKey,
          modelParams,
        },
        isBatch,
        args,
        history,
        startTime: startTime.getTime(),
      })
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
  }

  onSemanticFunctionImplementationError(errors: any) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onPromptEnrichmentStart({ args }: PromptEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'enrichment-pipeline',
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onPromptEnrichmentEnd({ messages, errors }: PromptEnrichmentOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onFeatureStoreEnrichmentStart({ args, featureStore }: FeatureStoreEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'feature-store-enrichment',
        featureStore,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onFeatureStoreEnrichmentEnd({ enrichedArgs, errors }: FeatureStoreEnrichmentOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onSemanticSearchEnrichmentStart({ args, index }: SemanticSearchEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'semantic-search-enrichment',
        index,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onSemanticSearchEnrichmentEnd({ enrichedArgs, errors }: SemanticSearchEnrichmentOnEndResponse) {
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

  onSemanticSearchEnrichmentError(errors: any) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onFunctionEnrichmentStart({ args, functionName, modelKey, modelParams, contentPropertyPath, contextPropertyPath }: FunctionEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'function-enrichment',
        functionName,
        modelKey,
        modelParams,
        contentPropertyPath,
        contextPropertyPath,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onFunctionEnrichmentEnd({ enrichedArgs, errors }: FunctionEnrichmentOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onSqlEnrichmentStart({ args }: SqlEnrichmentOnStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onPromptTemplateStart({ args, messageTemplates }: PromptTemplateOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        type: 'call-prompt-template',
        messageTemplates,
        args,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors: errors,
    });
  }

  onInputGuardrailStart({ guardrails, messages }: InputGuardrailsOnStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors: errors,
    });
  }

  onModelStart({ request }: ModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        id: uuid.v4(),
        ...request,
        modelParams: request.model_params,
        type: 'call-model',
        startTime: startTime.getTime(),
      })
      .down();
  }

  onLookupCache({ model, prompt, hit, response }: CacheResponse) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'lookup-cache',
      model,
      prompt,
      hit,
      response,
    });
  }

  onModelEnd({ response, errors }: ModelOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onCompletionModelStart({ request }: ModelOnStartResponse) {
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

  onCompletionModelEnd({ model, response, errors }: ModelOnEndResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onCustomModelStart({ args, isBatch, model, url }: CustomModelOnStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onHuggingfaceModelStart({ args, model }: HuggingfaceModelOnStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputProcessingStart({ response }: OutputProcessingResponse) {
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

  onOutputProcessingError(errors: any) {
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputGuardrailStart({ guardrail, response }: OutputGuardrailStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

  onOutputParserStart({ outputParser, response }: OutputParserStartResponse) {
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
    this.tracer.push({
      id: uuid.v4(),
      type: 'error',
      errors,
    });
  }

}
