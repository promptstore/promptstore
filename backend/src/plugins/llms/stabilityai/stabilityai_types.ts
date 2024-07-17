export interface StabilityAIImageRequest {
  prompt: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  seed?: number;
  output_format?: string;
  style_preset?: string;
}

export interface StabilityAIArtifact {
  seed: number;  // The value of the seed used to generate the image.
  image: string;  // The base64 encoded image that the model generated.
  finish_reason: string;  // The result of the image generation process. Valid values are: SUCCESS – The image generation process succeeded, ERROR – An error occured, CONTENT_FILTERED – The content filter filtered the image and the image might be blurred.
}
