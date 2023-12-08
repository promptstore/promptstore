import logger from '../../logger';

export type Trace = any[];

export class Tracer {

  name: string;
  type: string;
  db: any;
  trace: Trace;
  stack: Trace[];

  constructor(name: string, type: string = 'semfn') {
    this.name = name;
    this.type = type;
    this.trace = [];
    this.stack = [this.trace];
  }

  currentTrace() {
    return this.stack[this.stack.length - 1];
  }

  currentStep() {
    const trace = this.currentTrace();
    return trace[trace.length - 1];
  }

  push(step: any) {
    // logger.debug('!! push:', step.type);
    this.currentTrace().push(step);
    return this;
  }

  addProperty(key: string, value: any) {
    this.currentStep()[key] = value;
    return this;
  }

  addParentProperty(key: string, value: any) {
    const trace = this.stack[this.stack.length - 2];
    trace[trace.length - 1][key] = value;
  }

  down() {
    const children = [];
    this.currentStep()['children'] = children;
    // logger.debug('!! down:', this.currentStep()?.type || '?', this.stack.length);
    this.stack.push(children);
    // logger.debug('!! :', this.stack.length);
    return this;
  }

  up() {
    // logger.debug('!! up:', this.currentStep()?.type || '?');
    this.stack.pop();
    // logger.debug('!! :', this.currentStep()?.type || '?', this.stack.length);
    return this;
  }

  close() {
    const record = {
      name: this.name,
      traceType: this.type,
      trace: this.trace,
    };
    return record;
  }

}
