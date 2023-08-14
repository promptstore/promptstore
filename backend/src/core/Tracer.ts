export type Trace = object[];

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

  push(step: object) {
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
    this.stack.push(children);
    return this;
  }

  up() {
    this.stack.pop();
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
