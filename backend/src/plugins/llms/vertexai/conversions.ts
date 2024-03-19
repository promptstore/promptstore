import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatRequest,
  EmbeddingObject,
  EmbeddingRequest,
  ParserService,
  Message,
  MessageRole,
  createOpenAIMessages,
  createSystemPrompt,
} from '../../../core/conversions';
import {
  SystemMessage,
} from '../../../core/models/openai';

import {
  PaLMChatResponse,
  PaLMCompletionResponse,
  PaLMBatchEmbeddingResponse,
  PaLMEmbeddingResponse,
  PaLMExample,
  PaLMMessage,
} from './vertexai_types';

function mapPaLMMessage(message: Message) {
  return {
    author: message.name,
    content: message.content as string,
    citation_metadata: message.citation_metadata,
  };
}

function getPaLMMessages(messages: Message[], filterFunction: any) {
  return messages.filter(filterFunction).map(mapPaLMMessage);
}

function splitSystemMessages(messages: Message[]) {
  return [
    getPaLMMessages(messages, (m: Message) => m.role === 'system'),
    getPaLMMessages(messages, (m: Message) => m.role !== 'system')
  ];
}

export function toVertexAIChatRequest(request: ChatRequest) {
  const {
    prompt,
    model,
    model_params,
    functions,
  } = request;
  const {
    temperature,
    top_k,
    top_p,
    n,
  } = model_params;
  const systemMessages: PaLMMessage[] = [];
  const messages: PaLMMessage[] = [];
  if (prompt.history) {
    let [sysmsgs, msgs] = splitSystemMessages(prompt.history);
    systemMessages.push(...sysmsgs);
    messages.push(...msgs);
  }
  if (prompt.messages) {
    let [sysmsgs, msgs] = splitSystemMessages(prompt.messages);
    systemMessages.push(...sysmsgs);
    messages.push(...msgs);
  }
  let examples: PaLMExample[];
  if (prompt.examples) {
    examples = prompt.examples.map(({ input, output }) => ({
      input: toPaLMMessage(input),
      output: toPaLMMessage(output),
    }));
  }
  const context = createSystemPrompt(prompt.context, systemMessages as SystemMessage[], functions);
  return {
    model,
    prompt: {
      context,
      examples,
      messages,
    },
    temperature,
    candidate_count: n,
    top_p,
    top_k,
  };
}

export async function fromVertexAIChatResponse(
  response: PaLMChatResponse,
  parserService: ParserService,
) {
  const {
    candidates,
    filters,
  } = response;
  let choices: ChatCompletionChoice[];
  if (candidates.length) {
    const { json } = await parserService.parse('json', candidates[0].content);
    const { action, action_input } = json;
    if (action) {
      if (action === 'Final Answer') {
        choices = [
          {
            index: 0,
            message: {
              role: MessageRole.assistant,
              content: action_input,
              name: candidates[0].author,
              citation_metadata: candidates[0].citation_metadata,
              final: true,
            },
          }
        ];
      } else {
        const args = { input: action_input };
        choices = [
          {
            index: 0,
            message: {
              role: MessageRole.function,
              content: null,
              name: candidates[0].author,
              function_call: {
                name: action,
                arguments: JSON.stringify(args),
              },
              citation_metadata: candidates[0].citation_metadata,
            }
          }
        ];
      }
    } else {
      choices = candidates.map((c, i) => ({
        index: i,
        message: {
          role: MessageRole.assistant,
          content: c.content,
          name: c.author,
          citation_metadata: c.citation_metadata,
        }
      }));
    }
  } else {
    choices = [
      {
        index: 0,
        message: {
          role: MessageRole.assistant,
          content: 'No response from model',
          final: true,
        },
      }
    ];
  }
  return {
    id: uuid.v4(),
    created: new Date(),
    choices,
    n: candidates.length,
    filters,
  };
}

export function toVertexAICompletionRequest(request: ChatRequest) {
  const {
    functions,
    model,
    model_params,
    safety_settings,
  } = request;
  const messages = createOpenAIMessages(request.prompt, functions);
  const text = messages.map(m => m.content).join(PARA_DELIM);
  const {
    temperature,
    top_p,
    top_k,
    n,
    stop,
    max_tokens,
  } = model_params;
  return {
    model,
    prompt: { text },
    temperature,
    candidate_count: n,
    max_output_tokens: max_tokens,
    top_p,
    top_k,
    safety_settings,
    stop_sequences: stop,
  };
}

export async function fromVertexAICompletionResponse(
  response: PaLMCompletionResponse,
  parserService: ParserService,
) {
  const {
    candidates,
    filters,
    safety_feedback,
  } = response;
  let choices: ChatCompletionChoice[];
  if (candidates.length) {
    const { json } = await parserService.parse('json', candidates[0].output);
    const { action, action_input } = json;
    if (action) {
      if (action === 'Final Answer') {
        choices = [
          {
            index: 0,
            message: {
              role: MessageRole.assistant,
              content: action_input,
              citation_metadata: candidates[0].citation_metadata,
              final: true,
            },
            safety_ratings: candidates[0].safety_ratings,
          }
        ];
      } else {
        const args = { input: action_input };
        choices = [
          {
            index: 0,
            message: {
              role: MessageRole.function,
              content: null,
              function_call: {
                name: action,
                arguments: JSON.stringify(args),
              },
              citation_metadata: candidates[0].citation_metadata,
            },
            safety_ratings: candidates[0].safety_ratings,
          }
        ];
      }
    } else {
      choices = candidates.map((c, i) => ({
        index: i,
        message: {
          role: MessageRole.assistant,
          content: c.output,
          citation_metadata: c.citation_metadata,
        },
        safety_ratings: c.safety_ratings,
      }));
    }
  } else {
    choices = [
      {
        index: 0,
        message: {
          role: MessageRole.assistant,
          content: 'No response from model',
          final: true,
        },
      }
    ];
  }
  return {
    id: uuid.v4(),
    created: new Date(),
    choices,
    n: candidates.length,
    safetyFeedback: safety_feedback,
    filters,
  };
}

export function toVertexAIEmbeddingRequest(request: EmbeddingRequest) {
  const { model, input } = request;
  if (Array.isArray(input)) {
    return { model, texts: input };
  }
  return { model, text: input };
}

export function fromVertexAIEmbeddingResponse(
  response: PaLMEmbeddingResponse | PaLMBatchEmbeddingResponse,
) {
  let data: EmbeddingObject[];
  if ('embeddings' in response) {
    data = response.embeddings.map((e, index) => ({
      index,
      object: 'embedding',
      embedding: e.value,
    }));
  } else {
    data = [
      {
        index: 0,
        object: 'embedding',
        embedding: response.embedding.value,
      }
    ];
  }
  return {
    object: 'list',
    data,
  };
}

function toPaLMMessage(message: Message) {
  return {
    author: message.name,
    content: message.content as string,
    citation_metadata: message.citation_metadata,
  };
}
