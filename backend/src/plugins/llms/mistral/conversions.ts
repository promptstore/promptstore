import {
  ChatRequest,
  EmbeddingRequest,
  createOpenAIMessages,
} from '../../../core/conversions';

export function toMistralChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    stream,
    safe_mode,
    random_seed,
  } = request;
  const {
    temperature,
    top_p,
    max_tokens,
  } = model_params;
  const messages = createOpenAIMessages(request.prompt);
  return {
    model,
    messages,
    temperature,
    top_p,
    max_tokens,
    stream,
    safe_mode,
    random_seed,
  };
}

export function toMistralEmbeddingRequest(request: EmbeddingRequest) {
  const { input, model } = request;
  const texts = typeof input === 'string' ? [input] : input;
  return {
    model: model || 'mistral-embed',
    input: texts,
    encoding_format: 'float',
  };
}
