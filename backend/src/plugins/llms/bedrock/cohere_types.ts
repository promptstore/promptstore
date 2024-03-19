export interface CohereCompletionRequest {
  prompt: string;  // The input text that serves as the starting point for generating the response. Note: The prompt will be pre-processed and modified before reaching the model.
  model?: string;  // The identifier of the model to generate with. Currently available models are command (default), command-nightly (experimental), command-light, and command-light-nightly (experimental).
  num_generations?: number;  // The maximum number of generations that will be returned. Defaults to 1, min value of 1, max value of 5.
  stream?: boolean;  // When true, the response will be a JSON stream of events. The final event will contain the complete response, and will contain an is_finished field set to true. The event will also contain a finish_reason, which can be one of the following: - COMPLETE - the model sent back a finished reply - MAX_TOKENS - the reply was cut off because the model reached the maximum number of tokens for its context length - ERROR - something went wrong when generating the reply - ERROR_TOXIC - the model generated a reply that was deemed toxic
  max_tokens?: number;  // The maximum number of tokens the model will generate as part of the response. Note: Setting a low value may result in incomplete generations. This parameter is off by default, and if it's not specified, the model will continue generating until it emits an EOS completion token. See BPE Tokens for more details. Can only be set to 0 if return_likelihoods is set to ALL to get the likelihood of the prompt.
  truncate?: string;  // One of NONE|START|END to specify how the API will handle inputs longer than the maximum token length. Default: END
  temperature?: number;  // A non-negative float that tunes the degree of randomness in generation. Lower temperatures mean less random generations. See Temperature for more details. Defaults to 0.75, min value of 0.0, max value of 5.0.
  preset?: string;  // Identifier of a custom preset. A preset is a combination of parameters, such as prompt, temperature etc. You can create presets in the playground.
  end_sequences?: string[];  // The generated text will be cut at the beginning of the earliest occurrence of an end sequence. The sequence will be excluded from the text.
  stop_sequences?: string[];  // The generated text will be cut at the end of the earliest occurrence of a stop sequence. The sequence will be included the text.
  k?: number;  // Ensures only the top k most likely tokens are considered for generation at each step. Defaults to 0, min value of 0, max value of 500.
  p?: number;  // Ensures that only the most likely tokens, with total probability mass of p, are considered for generation at each step. If both k and p are enabled, p acts after k. Defaults to 0.75. min value of 0.01, max value of 0.99.
  frequency_penalty?: number;  // Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation.
  presence_penalty?: number;  // Defaults to 0.0, min value of 0.0, max value of 1.0. Can be used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies.
  return_likelihoods?: string;  // One of GENERATION|ALL|NONE to specify how and if the token likelihoods are returned with the response. Defaults to NONE. If GENERATION is selected, the token likelihoods will only be provided for generated text. If ALL is selected, the token likelihoods will be provided both for the prompt and the generated text. Default: NONE
  logit_bias?: object;  // Used to prevent the model from generating unwanted tokens or to incentivize it to include desired tokens. The format is {token_id: bias} where bias is a float between -10 and 10. Tokens can be obtained from text using Tokenize.
}

interface CohereTokenLikelihood {
  token: string;
  likelihood: number;
}

interface CohereBilledUnits {
  input_tokens?: number;
  output_tokens?: number;
  search_units?: number;
  classifications?: number;
}

interface CohereApiVersion {
  version: string;
  is_deprecated?: boolean;
  is_experimental?: boolean;
  billed_units?: CohereBilledUnits;
}

interface CohereGenerationMetadata {
  api_version: CohereApiVersion;
  warnings: string[];
}

interface CohereGeneration {
  id: string;
  text: string;
  index?: number;  // Refers to the nth generation. Only present when num_generations is greater than zero.
  likelihood?: number;
  token_likelihoods?: CohereTokenLikelihood[];  // Only returned if return_likelihoods is set to GENERATION or ALL. The likelihood refers to the average log-likelihood of the entire specified string, which is useful for evaluating the performance of your model, especially if you've created a custom model. Individual token likelihoods provide the log-likelihood of each token. The first token will not have a likelihood.
  finish_reason?: string;
}

export interface CohereCompletionResponse {
  id: string;
  prompt?: string;
  generations: CohereGeneration[];
  meta?: CohereGenerationMetadata;
}