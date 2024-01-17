import * as workflowClient from '../../workflow/clients';
import {
  SemanticFunctionOnEndResponse,
  SemanticFunctionOnStartResponse,
} from '../semanticfunctions/SemanticFunction_types';
import { Callback } from './Callback';

export class CallLoggingCallback extends Callback {

  startTime: Date[];
  workspaceId: number;
  username: string;

  constructor({ workspaceId, username }) {
    super();
    this.workspaceId = workspaceId;
    this.username = username;
    this.startTime = [];
  }

  onSemanticFunctionStart({ name, args, history, modelKey, modelParams, isBatch }: SemanticFunctionOnStartResponse) {
    const startTime = new Date();
    this.startTime.push(startTime);
  }

  onSemanticFunctionEnd({ errors, response, responseMetadata }: SemanticFunctionOnEndResponse) {
    const startTime = this.startTime.pop();
    const endTime = new Date();
    let error: string;
    let success = true;
    if (errors) {
      error = errors.map(err => err.message).join('\n\n');
      success = false;
    }
    const { model } = response || {};
    const {
      functionId,
      functionName,
      images,
      provider,
      promptTokens,
      completionTokens,
      totalTokens,
      systemInput,
      outputType,
      systemOutput,
      systemOutputText,
      modelInput,
      modelUserInputText,
      modelOutput,
      modelOutputText,
    } = responseMetadata || {};
    const params = {
      workspace_id: this.workspaceId,
      username: this.username,
      type: 'call-function',
      provider,
      model,
      function_id: functionId,
      function_name: functionName,
      system_input: systemInput,
      output_type: outputType,
      system_output: systemOutput,
      system_output_text: systemOutputText,
      model_input: modelInput,
      model_user_input_text: modelUserInputText,
      model_output: modelOutput,
      model_output_text: modelOutputText,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      image_uploaded_count: images?.length || 0,
      image_generated_count: 0,
      video_secs: 0,
      latency_ms: endTime.getTime() - startTime.getTime(),
      success,
      error,
      start_date: startTime,
      end_date: endTime,
    };
    workflowClient.logCall(params, {
      address: process.env.TEMPORAL_URL,
    });
  }

}