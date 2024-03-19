import uuid from 'uuid';

import {
  PARA_DELIM,
  ChatCompletionChoice,
  ChatCompletionUsage,
  ChatPrompt,
  ChatRequest,
  CitationMetadata,
  ContentObject,
  ContentType,
  Function,
  ImageContent,
  ParserService,
  MessageRole,
  SafetySetting,
  TextContent,
  getFunctionPrompts,
  getMimetype,
} from '../../../core/conversions';

import {
  GeminiChatResponse,
  GeminiContent,
  GeminiTools,
} from './gemini_types';

function getGeminiRole(role: MessageRole) {
  switch (role) {
    case MessageRole.system:
    case MessageRole.user:
      return 'user';

    case MessageRole.assistant:
      return 'model';

    default:
  }
}

function getGeminiContentParts(content: ContentType) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }
  if (Array.isArray(content) && content.length) {
    if (typeof content[0] === 'string') {
      return (content as string[]).map(text => ({ text }));
    }
    return (content as ContentObject[]).map(c => {
      if (c.type === 'text') {
        return { text: (c as TextContent).text };
      } else {
        const imageContent = c as ImageContent;
        const file_uri = imageContent.image_url.url;
        const { pathname } = new URL(file_uri);
        const filename = pathname.split('/').pop();
        const mime_type = getMimetype(filename);
        return { file_data: { mime_type, file_uri } };
      }
    });
  }
  return [];
}

function createGeminiContents(prompt: ChatPrompt, functions?: Function[]) {
  const contents: GeminiContent[] = [];
  if (prompt.history) {
    for (const message of prompt.history) {
      if (message.role !== 'function') {
        contents.push({
          role: getGeminiRole(message.role),
          parts: getGeminiContentParts(message.content),
        });
      }
    }
  }
  if (prompt.examples) {
    for (const { input, output } of prompt.examples) {
      contents.push({
        role: 'user',
        parts: getGeminiContentParts(input.content),
      });
      contents.push({
        role: 'model',
        parts: getGeminiContentParts(output.content),
      });
    }
  }
  for (const message of prompt.messages) {
    if (message.role !== 'function') {
      contents.push({
        role: getGeminiRole(message.role),
        parts: getGeminiContentParts(message.content),
      });
    }
  }
  return contents;
}

function createGeminiVisionContents(prompt: ChatPrompt, functions?: Function[]) {
  const contents: GeminiContent[] = [];
  for (const message of prompt.messages) {
    if (message.role !== 'function') {
      contents.push({
        role: getGeminiRole(message.role),
        parts: getGeminiContentParts(message.content),
      });
    }
  }
  if (functions) {
    const prompts = getFunctionPrompts(functions);
    const text = prompts.join(PARA_DELIM);
    const first = contents[0];
    const message = {
      role: 'user',
      parts: [...first.parts, { text }],
    };
    contents.splice(0, 1, message);
  }
  return contents;
}

export function toGeminiChatRequest(request: ChatRequest) {
  const {
    model,
    model_params,
    safe_mode,
    prompt,
    functions,
  } = request;
  const {
    temperature,
    top_p,
    top_k,
    max_tokens,
    stop,
  } = model_params;
  let contents: GeminiContent[];
  let tools: GeminiTools;
  if (model === 'gemini-1.0-pro-vision') {
    contents = createGeminiVisionContents(prompt, functions);
  } else {
    contents = createGeminiContents(prompt);
    if (functions) {
      tools = {
        function_declarations: functions,
      };
    }
  }
  let safety_settings: SafetySetting[];
  if (safe_mode) {
    safety_settings = [
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 2,  // medium probability and above
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 2,
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 2,
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 2,
      },
    ];
  }
  return {
    model,
    contents,
    generation_config: {
      temperature,
      top_p,
      top_k,
      candidate_count: 1,  // must be 1
      max_output_tokens: max_tokens,
      stop_sequences: stop,
    },
    tools,
    safety_settings,
  };
}

export async function fromGeminiChatResponse(
  response: GeminiChatResponse,
  parserService: ParserService,
) {
  try {
    const candidate = response.candidates[0];
    const text = candidate.content.parts[0].text;
    let choices: ChatCompletionChoice[];
    const { json, nonJsonStr } = await parserService.parse('json', text);
    if (json) {
      const { action, action_input, citations } = json;
      if (citations) {
        const content = nonJsonStr.replace(/\s*Citations:\s*/, PARA_DELIM).trim();
        choices = [
          {
            index: 0,
            finish_reason: candidate.finishReason.toString(),
            message: {
              role: MessageRole.assistant,
              content,
              citation_metadata: {
                citation_sources: citations.map((cit: any) => ({
                  uri: cit.source,
                  page: cit.page,
                  row: cit.row,
                  dataSourceId: cit.dataSourceId,
                  dataSourceName: cit.dataSourceName,
                })),
              },
            },
            safety_ratings: candidate.safetyRatings?.map(r => ({
              category: r.category,
              probability: r.probability,
            })),
          },
        ];
      } else if (action) {
        let citation_metadata: CitationMetadata;
        if (candidate.citationMetadata) {
          const citation_sources = candidate.citationMetadata.citations.map(c => ({
            start_index: c.startIndex,
            end_index: c.endIndex,
            uri: c.uri,
            license_: c.license,
          }));
          citation_metadata = { citation_sources };
        }
        if (action === 'Final Answer') {
          choices = [
            {
              index: 0,
              message: {
                role: MessageRole.assistant,
                content: action_input,
                citation_metadata,
                final: true,
              },
              safety_ratings: candidate.safetyRatings?.map(r => ({
                category: r.category,
                probability: r.probability,
              })),
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
                citation_metadata,
                function_call: {
                  name: action,
                  arguments: JSON.stringify(args),
                },
              },
              safety_ratings: candidate.safetyRatings?.map(r => ({
                category: r.category,
                probability: r.probability,
              })),
            }
          ];
        }
      }
    }
    if (!choices) {
      choices = response.candidates.map((c, i) => {
        let citation_metadata: CitationMetadata;
        if (c.citationMetadata) {
          const citation_sources = c.citationMetadata.citations.map(c => ({
            start_index: c.startIndex,
            end_index: c.endIndex,
            uri: c.uri,
            license_: c.license,
          }));
          citation_metadata = { citation_sources };
        }
        return {
          index: i,
          finish_reason: c.finishReason.toString(),
          message: {
            role: MessageRole.assistant,
            content: c.content.parts[0].text,
            citation_metadata,
          },
          safety_ratings: c.safetyRatings?.map(r => ({
            category: r.category,
            probability: r.probability,
          })),
        };
      });
    }
    let usage: ChatCompletionUsage;
    if (response.usageMetadata) {
      const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;
      usage = {
        completion_tokens: candidatesTokenCount,
        prompt_tokens: promptTokenCount,
        total_tokens: totalTokenCount,
      };
    }
    return {
      id: uuid.v4(),
      created: new Date(),
      choices,
      usage,
      n: choices.length,
    }
  } catch (err) {
    let message = err.message;
    if (err.stack) {
      message += '\n' + err.stack;
    }
    console.error(message);
    throw err;
  }
}
