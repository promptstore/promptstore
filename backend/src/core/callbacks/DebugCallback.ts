import { ValidatorResult } from 'jsonschema';

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
  GraphEnrichmentOnStartResponse,
  GraphEnrichmentOnEndResponse,
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

import { Callback } from './Callback';

export class DebugCallback extends Callback {

  clone() {
    return this;
  }

  onCompositionStart({ name, args, model, modelParams, isBatch }: CompositionOnStartResponse) {
    logger.debug('start composition', name);
  }

  onCompositionEnd({ name, response, errors }: CompositionOnEndResponse) {
    logger.debug('end composition', name);
  }

  onCompositionError(errors: any) {
    logger.error(errors);
  }

  onSemanticFunctionStart({ name, args, history, model, modelParams, isBatch }: SemanticFunctionOnStartResponse) {
    logger.debug('start function', name);
    logger.debug('batch:', isBatch ? 'true' : 'false');
    let input: any;
    if (isBatch) {
      input = args?.length ? args[0] : args;
    }
    logger.debug('input:', input);
    logger.debug('model:', model, modelParams);
    logger.debug('history:', history);
  }

  onSemanticFunctionEnd({ name, response, errors }: SemanticFunctionOnEndResponse) {
    logger.debug('end function', name);
  }

  onSemanticFunctionError(errors: any) {
    logger.error(errors);
  }

  onValidateArguments(validatorResult: ValidatorResult) {
    logger.debug('validating args');
    logger.debug('instance:', validatorResult.instance);
    logger.debug('schema:', validatorResult.schema);
    logger.debug('result:', validatorResult.valid ? 'valid' : 'invalid');
  }

  onMapArguments({ args, mapped, mappingTemplate, isBatch, source, errors }: MapArgumentsResponse) {
    logger.debug('mapping args');
    if (source) {
      logger.debug('source:', source.type, source.name);
    }
    logger.debug('batch:', isBatch ? 'true' : 'false');
    let input: any, output: any;
    if (isBatch) {
      input = args?.length ? args[0] : args;
      output = mapped?.length ? mapped[0] : mapped;
    } else {
      input = args;
      output = mapped;
    }
    logger.debug('input:', input);
    logger.debug('output:', output);
    logger.debug('mapping template:', mappingTemplate);
    logger.debug('errors:', errors);
  }

  onMapReturnType({ response, mapped, mappingTemplate, isBatch, errors }: MapReturnTypeResponse) {
    logger.debug('mapping response');
    logger.debug('batch:', isBatch ? 'true' : 'false');
    let input: any, output: any;
    if (isBatch) {
      input = response?.length ? response[0] : response;
      output = mapped?.length ? mapped[0] : mapped;
    } else {
      input = response;
      output = mapped;
    }
    logger.debug('input:', input);
    logger.debug('output:', output);
    logger.debug('mapping template:', mappingTemplate);
    logger.debug('errors:', errors);
  }

  onExperiment({ experiments, implementation }: ExperimentResponse) {
    logger.debug('selected experiment:', implementation);
  }

  onSemanticFunctionImplementationStart({ args, history, modelType, model, modelParams, isBatch }: SemanticFunctionImplementationOnStartResponse) {
    logger.debug('start implementation', model.model);
  }

  onSemanticFunctionImplementationEnd({ model, response, errors }: SemanticFunctionImplementationOnEndResponse) {
    logger.debug('end implementation', model.model);
  }

  onSemanticFunctionImplementationError(errors: any) {
    logger.error(errors);
  }

  onPromptEnrichmentStart({ args }: PromptEnrichmentOnStartResponse) {
    logger.debug('start enrichment pipeline');
  }

  onPromptEnrichmentEnd({ messages, errors }: PromptEnrichmentOnEndResponse) {
    logger.debug('end enrichment pipeline');
  }

  onPromptEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onFeatureStoreEnrichmentStart({ args, featureStore }: FeatureStoreEnrichmentOnStartResponse) {
    logger.debug('start enrichment from feature store', featureStore.name);
    logger.debug('params:', featureStore.params);
  }

  onFeatureStoreEnrichmentEnd({ featureStore, enrichedArgs, errors }: FeatureStoreEnrichmentOnEndResponse) {
    logger.debug('end enrichment from feature store', featureStore.name);
  }

  onFeatureStoreEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onSemanticSearchEnrichmentStart({ args, index }: SemanticSearchEnrichmentOnStartResponse) {
    logger.debug('start enrichment from index', index.name);
  }

  onSemanticSearchEnrichmentEnd({ enrichedArgs, errors }: SemanticSearchEnrichmentOnEndResponse) {
    logger.debug('end enrichment');
  }

  onSemanticSearchEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onFunctionEnrichmentStart({ args, functionName, model, modelParams, contentPropertyPath, contextPropertyPath }: FunctionEnrichmentOnStartResponse) {
    logger.debug('start function enrichment', functionName);
  }

  onFunctionEnrichmentEnd({ functionName, enrichedArgs, errors }: FunctionEnrichmentOnEndResponse) {
    logger.debug('end function enrichment', functionName);
  }

  onFunctionEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onSqlEnrichmentStart({ args }: SqlEnrichmentOnStartResponse) {
    logger.debug('start enrichment from SQL source');
  }

  onSqlEnrichmentEnd({ enrichedArgs, errors }: SqlEnrichmentOnEndResponse) {
    logger.debug('end enrichment from SQL source');
  }

  onSqlEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onGraphEnrichmentStart({ args }: GraphEnrichmentOnStartResponse) {
    logger.debug('start enrichment from Knowledge Graph source');
  }

  onGraphEnrichmentEnd({ enrichedArgs, errors }: GraphEnrichmentOnEndResponse) {
    logger.debug('end enrichment from Knowledge Graph source');
  }

  onGraphEnrichmentError(errors: any) {
    logger.error(errors);
  }

  onPromptTemplateStart({ args, messageTemplates }: PromptTemplateOnStartResponse) {
    logger.debug('start filling template');
  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {
    logger.debug('end filling template');
  }

  onPromptTemplateError(errors: any) {
    logger.error(errors);
  }

  onInputGuardrailStart({ guardrails, messages }: InputGuardrailsOnStartResponse) {
    logger.debug('start input guardrails');
  }

  onInputGuardrailEnd({ valid, errors }: InputGuardrailsOnEndResponse) {
    logger.debug('end input guardrails');
  }

  onInputGuardrailError(errors: any) {
    logger.error(errors);
  }

  onModelStart({ request }: ModelOnStartResponse) {
    const { model, model_params, prompt } = request;
    logger.debug('start model:', model, model_params);
    if (prompt.context) {
      logger.debug('context:', prompt.context.system_prompt);
    }
    if (prompt.history) {
      logger.debug('history:', prompt.history);
    }
    logger.debug('messages:', prompt.messages);
  }

  onLookupCache({ model, prompt, hit, response }: CacheResponse) {
    logger.debug('cache hit:', hit ? 'Yes' : 'No');
  }

  onModelEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('end model:', response.model);
    logger.debug('output:', response);
  }

  onModelError(errors: any) {
    logger.error(errors);
  }

  onCompletionModelStart({ request }: ModelOnStartResponse) {
    const { model, prompt } = request;
    logger.debug('start completion model:', model);
    if (prompt.context) {
      logger.debug('context:', prompt.context.system_prompt);
    }
    if (prompt.history) {
      logger.debug('history:', prompt.history);
    }
    logger.debug('messages:', prompt.messages);
  }

  onCompletionModelEnd({ response, errors }: ModelOnEndResponse) {
    logger.debug('end completion model:', response.model);
    logger.debug('output:', response);
  }

  onCompletionModelError(errors: any) {
    logger.error(errors);
  }

  onCustomModelStart({ args, isBatch, model, url }: CustomModelOnStartResponse) {
    logger.debug('start custom model:', model);
  }

  onCustomModelEnd({ model, response, errors }: CustomModelOnEndResponse) {
    logger.debug('end custom model:', model);
  }

  onCustomModelError(errors: any) {
    logger.error(errors);
  }

  onHuggingfaceModelStart({ args, model }: HuggingfaceModelOnStartResponse) {
    logger.debug('start huggingface model:', model);
  }

  onHuggingfaceModelEnd({ model, response, errors }: HuggingfaceModelOnEndResponse) {
    logger.debug('end huggingface model:', model);
  }

  onHuggingfaceModelError(errors: any) {
    logger.error(errors);
  }

  onOutputProcessingStart({ response }: OutputProcessingResponse) {
    logger.debug('start output processing pipeline');
  }

  onOutputProcessingEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('end output processing pipeline');
  }

  onOutputProcessingError(errors: any) {
    logger.error(errors);
  }

  onOutputGuardrailStart({ guardrail, response }: OutputGuardrailStartResponse) {
    logger.debug('start output guardrail check');
  }

  onOutputGuardrailEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('end output guardrail check');
  }

  onOutputGuardrailError(errors: any) {
    logger.error(errors);
  }

  onOutputParserStart({ outputParser, response }: OutputParserStartResponse) {
    logger.debug('start output parser');
  }

  onOutputParserEnd({ response, errors }: OutputProcessingResponse) {
    logger.debug('end output parser');
  }

  onOutputParserError(errors: any) {
    logger.error(errors);
  }

}
