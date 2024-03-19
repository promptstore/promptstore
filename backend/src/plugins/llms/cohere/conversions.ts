import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatPrompt,
  ChatRequest,
  CitationMetadata,
  ContentObject,
  EmbeddingObject,
  EmbeddingRequest,
  Function,
  Message,
  MessageRole,
  TextContent,
  convertContentTypeToString,
  getFunctionPrompts,
} from '../../../core/conversions';

import {
  CohereChatCompletionResponse,
  CohereEmbeddingResponse,
  CohereTool,
} from './cohere_types';

function mapCohereMessage(message: Message) {
  let m: string;
  if (typeof message.content === 'string') {
    m = message.content;
  } else if (Array.isArray(message.content)) {
    const ms = [];
    let c: string | ContentObject;
    for (c of message.content) {
      if (typeof c === 'string') {
        ms.push(c);
        continue;
      }
      if (c.type === 'text') {
        const textContent = c as TextContent;
        ms.push(textContent.text);
        continue;
      }
    }
    m = ms.join(PARA_DELIM);
  }
  return {
    role: message.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m,

    // TODO
    // generation_id,
    // response_id,
  };
}

function createCoherePrompts(prompt: ChatPrompt, functions?: Function[]) {
  const history = [];
  const examples = [];
  let messages = [];
  const systemPrompts = [];
  if (prompt.history) {
    for (const message of prompt.history) {
      if (message.role === 'system') {
        systemPrompts.push(convertContentTypeToString(message.content));
        continue;
      }
      if (message.role !== 'function') {
        history.push(mapCohereMessage(message));
      }
    }
  }
  if (prompt.examples) {
    for (const { input, output } of prompt.examples) {
      examples.push('USER: ' + input.content);
      examples.push('CHATBOT: ' + output.content);
    }
  }
  for (const message of prompt.messages) {
    if (message.role === 'system') {
      systemPrompts.push(convertContentTypeToString(message.content));
      continue;
    }
    if (message.role !== 'function') {
      const m = mapCohereMessage(message);
      messages.push(m.message);
    }
  }
  if (functions?.length) {
    systemPrompts.push(...getFunctionPrompts(functions));
  }
  if (examples.length) {
    messages = [
      'The following are example CHATBOT responses to USER inputs:',
      ...examples,
      ...messages,
    ];
  }
  return {
    preamble: systemPrompts.join(PARA_DELIM),
    chat_history: history,
    message: messages.join(PARA_DELIM),
  };
}

export function toCohereChatRequest(request: ChatRequest) {
  const {
    functions,
    model,
    model_params,
    prompt,
    stream,
  } = request;
  const {
    temperature,
    top_k,
    top_p,
    max_tokens,
    frequency_penalty,
    presence_penalty,
  } = model_params;
  const { preamble, chat_history, message } = createCoherePrompts(prompt, functions);
  let tools: CohereTool[];
  if (functions?.length) {
    tools = functions.map(f => ({
      name: f.name,
      description: f.description,
      parameter_definitions: Object.entries(f.parameters.properties).reduce((a, [k, v]) => {
        a[k] = {
          description: v.description,
          type: v.type,  // TODO convert to Python type
          required: !!f.parameters.required?.[k],
        };
        return a;
      }, {}),
    }));
  }
  return {
    message,
    model,
    stream,
    preamble,
    chat_history,
    temperature,
    max_tokens,
    k: top_k,
    p: top_p,
    frequency_penalty,
    presence_penalty,
    tools,
  };
}

export function toCohereEmbeddingRequest(request: EmbeddingRequest) {
  const { input, inputType, model } = request;
  const texts = typeof input === 'string' ? [input] : input;
  return {
    model: model || 'embed-english-v3.0',
    texts,
    inputType: inputType || 'search_document',
  };
}

export function fromCohereChatResponse(response: CohereChatCompletionResponse) {
  const {
    text,
    generation_id,
    citations,
    finish_reason,
    tool_calls,
  } = response;
  let citation_metadata: CitationMetadata;
  if (citations?.length) {
    citation_metadata = {
      citation_sources: citations.map(cit => ({
        start_index: cit.start,
        end_index: cit.end,

        // TODO
        // text,
        // document_ids,
      })),
    };
  }
  let choices: ChatCompletionChoice[];
  if (tool_calls?.length) {
    choices = tool_calls.map((call, i) => ({
      finish_reason,
      index: i,
      message: {
        role: MessageRole.function,
        content: null,
        function_call: {
          name: call.name,
          arguments: JSON.stringify(call.parameters),
        },
      },
    }));
  } else {
    choices = [
      {
        finish_reason,
        index: 0,
        message: {
          role: MessageRole.assistant,
          content: text,
          citation_metadata,
        },
      }
    ];
  }
  const completion_tokens = 0;
  const prompt_tokens = 0;
  return {
    id: generation_id,
    created: new Date(),
    n: choices.length,
    choices,
    usage: {
      completion_tokens,
      prompt_tokens,
      total_tokens: prompt_tokens + completion_tokens,
    }
  };
}

export function fromCohereEmbeddingResponse(response: CohereEmbeddingResponse) {
  let data: EmbeddingObject[];
  if ('embeddings' in response) {
    data = response.embeddings.map((e, index) => ({
      index,
      object: 'embedding',
      embedding: e,
    }));
  }
  const { billed_units } = response.meta;
  return {
    object: 'list',
    data,
    usage: {
      prompt_tokens: billed_units?.input_tokens,
      total_tokens: billed_units?.output_tokens,
    },
  };
}
