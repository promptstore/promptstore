import { default as dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { Callback } from './Callback';
import {
  OutputProcessingCallParams,
  OutputProcessingEndParams,
  OutputProcessingPipelineParams,
  OutputProcessingStep,
} from './OutputProcessingPipeline_types';
// import { Tracer } from './Tracer';

import logger from '../logger';

dayjs.extend(relativeTime);

export class OutputProcessingPipeline {

  steps: OutputProcessingStep[];
  callbacks: Callback[];
  currentCallbacks: Callback[];
  // tracer: Tracer;
  // startTime: Date;

  constructor({
    steps,
    callbacks,
  }: OutputProcessingPipelineParams) {
    this.steps = steps;
    this.callbacks = callbacks || [];
    // this.tracer = new Tracer(this.getTraceName());
  }

  async call({ result, callbacks = [] }: OutputProcessingCallParams) {
    this.currentCallbacks = [...this.callbacks, ...callbacks];
    this.onStart({ result });
    try {
      for (const step of this.steps) {
        // step.tracer = this.tracer;
        result = await step.call({ result, callbacks });
      }
      return result;
    } catch (err) {
      const errors = err.errors || [{ message: String(err) }];
      this.onEnd({ errors });
      throw err;
    }
  }

  getTraceName() {
    return ['output-processing-pipeline', new Date().toISOString()].join(' - ');
  }

  onStart({ result }: OutputProcessingCallParams) {
    // logger.info('start output processing pipeline');
    // this.startTime = new Date();
    // this.tracer.push({
    //   type: 'output-processing-pipeline',
    //   input: result,
    //   startTime: this.startTime.getTime(),
    // });
    for (let callback of this.currentCallbacks) {
      callback.onOutputProcessingStart({
        result,
        // trace: this.tracer.currentTrace(),
      });
    }
    // this.tracer.down();
  }

  onEnd({ result, errors }: OutputProcessingEndParams) {
    // logger.info('end output processing pipeline');
    // const endTime = new Date();
    // this.tracer
    //   .up()
    //   .addProperty('endTime', endTime.getTime())
    //   .addProperty('elapsedMillis', endTime.getTime() - this.startTime.getTime())
    //   .addProperty('elapsedReadable', dayjs(endTime).from(this.startTime))
    //   ;
    // if (errors) {
    //   this.tracer
    //     .addProperty('errors', errors)
    //     .addProperty('success', false)
    //     ;
    // } else {
    //   this.tracer
    //     .addProperty('output', result)
    //     .addProperty('success', true)
    //     ;
    // }
    for (let callback of this.currentCallbacks) {
      callback.onOutputProcessingEnd({
        result,
        // trace: this.tracer.currentTrace(),
      });
    }
  }

}
