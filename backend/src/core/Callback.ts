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

  onMapArguments({ args, mapped, mappingTemplate, isBatch }: MapArgumentsResponse) {

  }

  onMapReturnType({ response, mapped, mappingTemplate, isBatch }: MapReturnTypeResponse) {

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

  onModelStart({ messages, modelKey, modelParams }: ModelOnStartResponse) {

  }

  onModelEnd({ response, errors }: ModelOnEndResponse) {

  }

  onModelError(errors: any) {

  }

  onCompletionModelStart({ messages, modelKey, modelParams }: ModelOnStartResponse) {

  }

  onCompletionModelEnd({ modelKey, response, errors }: ModelOnEndResponse) {

  }

  onCompletionModelError(errors: any) {

  }

  onCustomModelStart({ args, isBatch, modelKey, url }: CustomModelOnStartResponse) {

  }

  onCustomModelEnd({ response, errors }: CustomModelOnEndResponse) {

  }

  onCustomModelError(errors: any) {

  }

  onHuggingfaceModelStart({ args, modelKey }: HuggingfaceModelOnStartResponse) {

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
