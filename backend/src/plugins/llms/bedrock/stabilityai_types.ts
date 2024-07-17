export interface StabilityAIImageRequest {
  prompt: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  seed?: number;
  output_format?: string;
}

interface StabilityAITextPrompt {
  text: string;
  weight?: number;  // The weight that the model should apply to the prompt. A value that is less than zero declares a negative prompt. Use a negative prompt to tell the model to avoid certain concepts. The default value for weight is one.
}

export interface StabilityAIBedrockImageRequest {
  text_prompts: StabilityAITextPrompt[];  // An array of text prompts to use for generation.
  height?: number;  // Height of the image to generate, in pixels, in an increment divible by 64. The value must be one of 1024x1024, 1152x896, 1216x832, 1344x768, 1536x640, 640x1536, 768x1344, 832x1216, 896x1152
  width?: number;  // Width of the image to generate, in pixels, in an increment divible by 64. The value must be one of 1024x1024, 1152x896, 1216x832, 1344x768, 1536x640, 640x1536, 768x1344, 832x1216, 896x1152
  cfg_scale?: number;  // Determines how much the final image portrays the prompt. Use a lower number to increase randomness in the generation. Min 0, Max 35, Default 7
  clip_guidance_preset?: string;  // Enum: FAST_BLUE, FAST_GREEN, NONE, SIMPLE SLOW, SLOWER, SLOWEST.
  sampler?: string;  // The sampler to use for the diffusion process. If this value is omitted, the model automatically selects an appropriate sampler for you. Enum: DDIM, DDPM, K_DPMPP_2M, K_DPMPP_2S_ANCESTRAL, K_DPM_2, K_DPM_2_ANCESTRAL, K_EULER, K_EULER_ANCESTRAL, K_HEUN K_LMS.
  samples?: any;  // The number of image to generate. Currently Amazon Bedrock supports generating one image. If you supply a value for samples, the value must be one. Min 1, Max 1, Default 1
  seed?: number;  // The seed determines the initial noise setting. Use the same seed and the same settings as a previous run to allow inference to create a similar image. If you don't set this value, or the value is 0, it is set as a random number. Min 0, Max 4294967295, Default 0
  steps?: number;  // Generation step determines how many times the image is sampled. More steps can result in a more accurate result. Min 10, Max 50, Default 30  
  style_preset?: number;  // A style preset that guides the image model towards a particular style. This list of style presets is subject to change. Enum: 3d-model, analog-film, anime, cinematic, comic-book, digital-art, enhance, fantasy-art, isometric, line-art, low-poly, modeling-compound, neon-punk, origami, photographic, pixel-art, tile-texture
  extras?: any;  // Extra parameters passed to the engine. Use with caution. These parameters are used for in-development or experimental features and might change without warning.
}

interface StabilityAIArtifact {
  seed: number;  // The value of the seed used to generate the image.
  base64: string;  // The base64 encoded image that the model generated.
  finishedReason: string;  // The result of the image generation process. Valid values are: SUCCESS – The image generation process succeeded, ERROR – An error occured, CONTENT_FILTERED – The content filter filtered the image and the image might be blurred.
}

export interface StabilityAIBedrockImageResponse {
  result: string;  // The result of the operation. If successful, the response is success.
  artifacts: StabilityAIArtifact[];  // An array of images, one for each requested image, which is currently limited to 1.
}