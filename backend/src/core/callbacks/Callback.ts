import { ValidatorResult } from 'jsonschema';

import {
  MapArgumentsResponse,
  MapReturnTypeResponse,
} from '../common_types';
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

export class Callback {

  onCompositionStart({ args, modelKey, modelParams, isBatch }: CompositionOnStartResponse) {

  }

  onCompositionEnd({ response, errors }: CompositionOnEndResponse) {

  }

  onCompositionError(errors: any) {

  }

  onSemanticFunctionStart({ name, args, history, modelKey, modelParams, isBatch }: SemanticFunctionOnStartResponse) {

  }

  onSemanticFunctionEnd({ response, errors }: SemanticFunctionOnEndResponse) {

  }

  onSemanticFunctionError(errors: any) {

  }

  onValidateArguments(validatorResult: ValidatorResult) {

  }

  onMapArguments({ args, mapped, mappingTemplate, isBatch, source, errors }: MapArgumentsResponse) {

  }

  onMapReturnType({ response, mapped, mappingTemplate, isBatch, errors }: MapReturnTypeResponse) {

  }

  onExperiment({ experiments, implementation }: ExperimentResponse) {

  }

  onSemanticFunctionImplementationStart({ args, history, modelType, modelKey, modelParams, isBatch }: SemanticFunctionImplementationOnStartResponse) {

  }

  onSemanticFunctionImplementationEnd({ response, errors }: SemanticFunctionImplementationOnEndResponse) {

  }

  onSemanticFunctionImplementationError(errors: any) {

  }

  onPromptEnrichmentStart({ args }: PromptEnrichmentOnStartResponse) {

  }

  onPromptEnrichmentEnd({ messages, errors }: PromptEnrichmentOnEndResponse) {

  }

  onPromptEnrichmentError(errors: any) {

  }

  onFeatureStoreEnrichmentStart({ args, featureStore }: FeatureStoreEnrichmentOnStartResponse) {

  }

  onFeatureStoreEnrichmentEnd({ enrichedArgs, errors }: FeatureStoreEnrichmentOnEndResponse) {

  }

  onFeatureStoreEnrichmentError(errors: any) {

  }

  onSemanticSearchEnrichmentStart({ args, index }: SemanticSearchEnrichmentOnStartResponse) {

  }

  onSemanticSearchEnrichmentEnd({ enrichedArgs, errors }: SemanticSearchEnrichmentOnEndResponse) {

  }

  onSemanticSearchEnrichmentError(errors: any) {

  }

  onFunctionEnrichmentStart({ args, functionName, modelKey, modelParams, contentPropertyPath, contextPropertyPath }: FunctionEnrichmentOnStartResponse) {

  }

  onFunctionEnrichmentEnd({ enrichedArgs, errors }: FunctionEnrichmentOnEndResponse) {

  }

  onFunctionEnrichmentError(errors: any) {

  }

  onSqlEnrichmentStart({ args }: SqlEnrichmentOnStartResponse) {

  }

  onSqlEnrichmentEnd({ enrichedArgs, errors }: SqlEnrichmentOnEndResponse) {

  }

  onSqlEnrichmentError(errors: any) {

  }

  onGraphEnrichmentStart({ args }: GraphEnrichmentOnStartResponse) {

  }

  onGraphEnrichmentEnd({ enrichedArgs, errors }: GraphEnrichmentOnEndResponse) {

  }

  onGraphEnrichmentError(errors: any) {

  }

  onPromptTemplateStart({ args, messageTemplates }: PromptTemplateOnStartResponse) {

  }

  onPromptTemplateEnd({ messages, errors }: PromptTemplateOnEndResponse) {

  }

  onPromptTemplateError(errors: any) {

  }

  onInputGuardrailStart({ guardrails, messages }: InputGuardrailsOnStartResponse) {

  }

  onInputGuardrailEnd({ valid, errors }: InputGuardrailsOnEndResponse) {

  }

  onInputGuardrailError(errors: any) {

  }

  onModelStart({ request }: ModelOnStartResponse) {

  }

  onLookupCache({ model, prompt, hit, response }: CacheResponse) {

  }

  onModelEnd({ model, response, errors }: ModelOnEndResponse) {

  }

  onModelError(errors: any) {

  }

  onCompletionModelStart({ request }: ModelOnStartResponse) {

  }

  onCompletionModelEnd({ model, response, errors }: ModelOnEndResponse) {

  }

  onCompletionModelError(errors: any) {

  }

  onCustomModelStart({ args, isBatch, model, url }: CustomModelOnStartResponse) {

  }

  onCustomModelEnd({ response, errors }: CustomModelOnEndResponse) {

  }

  onCustomModelError(errors: any) {

  }

  onHuggingfaceModelStart({ args, model }: HuggingfaceModelOnStartResponse) {

  }

  onHuggingfaceModelEnd({ response, errors }: HuggingfaceModelOnEndResponse) {

  }

  onHuggingfaceModelError(errors: any) {

  }

  onOutputProcessingStart({ response }: OutputProcessingResponse) {

  }

  onOutputProcessingEnd({ response, errors }: OutputProcessingResponse) {

  }

  onOutputProcessingError(errors: any) {

  }

  onOutputGuardrailStart({ guardrail, response }: OutputGuardrailStartResponse) {

  }

  onOutputGuardrailEnd({ response, errors }: OutputProcessingResponse) {

  }

  onOutputGuardrailError(errors: any) {

  }

  onOutputParserStart({ outputParser, response }: OutputParserStartResponse) {

  }

  onOutputParserEnd({ response, errors }: OutputProcessingResponse) {

  }

  onOutputParserError(errors: any) {

  }

}
