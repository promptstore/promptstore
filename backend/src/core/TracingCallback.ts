import { default as dayjs } from 'dayjs';
import { ValidatorResult } from 'jsonschema';

import { MapArgumentsResponse, MapReturnTypeResponse } from './common_types';
import {
  CompositionOnStartResponse,
  CompositionOnEndResponse,
} from './Composition_types';
import {
  InputGuardrailsOnEndResponse,
  InputGuardrailsOnStartResponse,
} from './InputGuardrails_types';
import {
  SemanticFunctionOnStartResponse,
  SemanticFunctionOnEndResponse,
} from './SemanticFunction_types';
import {
  SemanticFunctionImplementationOnStartResponse,
  SemanticFunctionImplementationOnEndResponse,
} from './SemanticFunctionImplementation_types';
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
} from './PromptEnrichmentPipeline_types';
import {
  PromptTemplateOnStartResponse,
  PromptTemplateOnEndResponse,
} from './PromptTemplate_types';
import {
  ModelOnStartResponse,
  ModelOnEndResponse,
  CustomModelOnStartResponse,
  CustomModelOnEndResponse,
  HuggingfaceModelOnStartResponse,
  HuggingfaceModelOnEndResponse,
} from './Model_types';
import {
  OutputProcessingResponse,
  OutputGuardrailStartResponse,
  OutputParserStartResponse,
} from './OutputProcessingPipeline_types';
import { Tracer } from './Tracer';

interface TraceCallbackParams {
  workspaceId: number;
  username: string;
  tracesService: any;
}

export class TracingCallback {

  isComposition: boolean;
  tracer: Tracer;
  startTime: Date[];
  workspaceId: number;
  username: string;
  tracesService: any;

  constructor({ workspaceId, username, tracesService }: TraceCallbackParams) {
    this.workspaceId = workspaceId;
    this.username = username;
    this.tracesService = tracesService;
    this.startTime = [];
  }

  onCompositionStart({ args, modelKey, modelParams, isBatch }: CompositionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'call-composition',
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
      type: 'error',
      errors,
    });
  }

  onValidateArguments(validatorResult: ValidatorResult) {
    this.tracer.push({
      type: 'validate-args',
      instance: validatorResult.instance,
      schema: validatorResult.schema,
      valid: validatorResult.valid,
      errors: validatorResult.errors,
    });
  }

  onMapArguments({ args, mapped, mappingTemplate, isBatch }: MapArgumentsResponse) {
    if (isBatch) {
      this.tracer.push({
        type: 'map-args',
        input: args?.length ? args[0] : args,
        output: mapped?.length ? mapped[0] : mapped,
        isBatch,
        mappingTemplate,
      });
    } else {
      this.tracer.push({
        type: 'map-args',
        input: args,
        output: mapped,
        isBatch,
        mappingTemplate,
      });
    }
  }

  onMapReturnType({ response, mapped, mappingTemplate, isBatch }: MapReturnTypeResponse) {
    if (isBatch) {
      this.tracer.push({
        type: 'map-response',
        input: response?.length ? response[0] : response,
        output: mapped?.length ? mapped[0] : mapped,
        isBatch,
        mappingTemplate,
      });
    } else {
      this.tracer.push({
        type: 'map-response',
        input: response,
        output: mapped,
        isBatch,
        mappingTemplate,
      });
    }
  }

  onSemanticFunctionImplementationStart({ args, history, modelType, modelKey, modelParams, isBatch }: SemanticFunctionImplementationOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onPromptEnrichmentStart({ args }: PromptEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onFeatureStoreEnrichmentStart({ args, featureStore }: FeatureStoreEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onSemanticSearchEnrichmentStart({ args, index }: SemanticSearchEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onFunctionEnrichmentStart({ args, functionName, modelKey, modelParams, contentPropertyPath, contextPropertyPath }: FunctionEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onSqlEnrichmentStart({ args }: SqlEnrichmentOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onPromptTemplateStart({ args, messageTemplates }: PromptTemplateOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors: errors,
    });
  }

  onInputGuardrailStart({ guardrails, messages }: InputGuardrailsOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors: errors,
    });
  }

  onModelStart({ messages, modelKey, modelParams }: ModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'call-model',
        model: modelKey,
        modelParams,
        messages,
        startTime: startTime.getTime(),
      })
      .down();
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
      type: 'error',
      errors,
    });
  }

  onCompletionModelStart({ messages, modelKey, modelParams }: ModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'call-model',
        model: modelKey,
        modelParams,
        messages,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onCompletionModelEnd({ modelKey, response, errors }: ModelOnEndResponse) {
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
      type: 'error',
      errors,
    });
  }

  onCustomModelStart({ args, isBatch, modelKey, url }: CustomModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'call-custom-model',
        model: modelKey,
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
      type: 'error',
      errors,
    });
  }

  onHuggingfaceModelStart({ args, modelKey }: HuggingfaceModelOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'call-huggingface-model',
        model: modelKey,
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
      type: 'error',
      errors,
    });
  }

  onOutputProcessingStart({ response }: OutputProcessingResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
        type: 'output-processing-pipeline',
        input: response,
        startTime: startTime.getTime(),
      })
      .down();
  }

  onOutputProcessingEnd({ response, errors }) {
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
      type: 'error',
      errors,
    });
  }

  onOutputGuardrailStart({ guardrail, response }: OutputGuardrailStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

  onOutputParserStart({ outputParser, response }: OutputParserStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
    this.tracer
      .push({
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
      type: 'error',
      errors,
    });
  }

}
