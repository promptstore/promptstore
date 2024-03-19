import {
  Function,
  SafetyRating,
  SafetySetting,
} from '../../../core/conversions/RosettaStone';

interface GeminiPartInlineData {
  mime_type: string;
  data: string;  // The base64 encoding of the image or video to include inline in the prompt. When including media inline, you must also specify MIMETYPE. size limit: 20MB
}

interface GeminiPartFileData {
  mime_type: string;
  file_uri: string;  // The Cloud Storage URI of the image or video to include in the prompt. The bucket that stores the file must be in the same Google Cloud project that's sending the request. You must also specify MIMETYPE. size limit: 20MB
}

interface VideoOffset {
  seconds: number;
  nanos: number;
}

interface GeminiPartVideoMetadata {
  start_offset: VideoOffset;
  end_offset: VideoOffset;
}

interface GeminiContentPart {
  text: string;  // The text instructions or chat dialogue to include in the prompt.
  inline_data: GeminiPartInlineData;  // Serialized bytes data of the image or video. You can specify at most 1 image with inlineData. To specify up to 16 images, use fileData.
  file_data: GeminiPartFileData;
  video_metadata: GeminiPartVideoMetadata;  // For video input, the start and end offset of the video in Duration format. For example, to specify a 10 second clip starting at 1:00, set "start_offset": { "seconds": 60 } and "end_offset": { "seconds": 70 }.
}

export interface GeminiContent {
  role: string;  // The role in a conversation associated with the content. Specifying a role is required even in singleturn use cases. Acceptable values include the following: USER: Specifies content that's sent by you. MODEL: Specifies the model's response.
  parts: Partial<GeminiContentPart>[];  // Ordered parts that make up the input. Parts may have different MIME types. For gemini-pro, only the text field is valid. The token limit is 32k. For gemini-pro-vision, you may specify either text only, text and up to 16 images, or text and 1 video. The token limit is 16k.
}

export interface GeminiTools {
  function_declarations: Function[];
}

interface GeminiGenerationConfig {
  temperature: number;  // Default for gemini-pro: 0.9 Default for gemini-pro-vision: 2048
  top_p: number;  // Default: 1.0
  top_k: number;  // Default for gemini-pro-vision: 32 Default for gemini-pro: none
  candidate_count: number;  // This value must be 1.
  max_output_tokens: number;
  stop_sequences: string[];  // Maximum 5 items in the list.
}

export interface GeminiChatRequest {
  model: string;
  contents: GeminiContent[];
  tools?: GeminiTools;  // A piece of code that enables the system to interact with external systems to perform an action, or set of actions, outside of knowledge and scope of the model.
  safety_settings?: SafetySetting[];
  generation_config: Partial<GeminiGenerationConfig>;
}

enum GeminiFinishReasonEnum {
  FINISH_REASON_UNSPECIFIED,  // The finish reason is unspecified.
  FINISH_REASON_STOP,  // Natural stop point of the model or provided stop sequence.
  FINISH_REASON_MAX_TOKENS,  // The maximum number of tokens as specified in the request was reached.
  FINISH_REASON_SAFETY,  // The token generation was stopped as the response was flagged for safety reasons. Note that Candidate.content is empty if content filters block the output.
  FINISH_REASON_RECITATION,  // The token generation was stopped as the response was flagged for unauthorized citations.
  FINISH_REASON_OTHER,  // All other reasons that stopped the token
}

interface GeminiSafetyRating extends SafetyRating {
  blocked: boolean;
}

interface PublicationDate {
  year: number;
  month: number;
  day: number;
}

interface GeminiCitationSource {
  startIndex: number;
  endIndex: number;
  uri: string;
  title: string;
  license: string;
  publicationDate: PublicationDate;
}

interface GeminiCitationMetadata {
  citations: GeminiCitationSource[];
}

interface GeminiResponseCandidate {
  content: GeminiContent;
  finishReason: GeminiFinishReasonEnum;
  safetyRatings?: GeminiSafetyRating[];
  citationMetadata?: GeminiCitationMetadata;

}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface GeminiChatResponse {
  candidates: GeminiResponseCandidate[];
  usageMetadata: GeminiUsageMetadata;
}