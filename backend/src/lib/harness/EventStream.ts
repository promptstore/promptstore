/**
 * Push-based async iterable with a final result promise.
 * Producers call `push`; the stream completes when `isComplete(event)` is
 * true or `end(result)` is called.
 */
export class EventStream<T, R = void> implements AsyncIterable<T> {

  private queue: T[] = [];
  private waiting: ((r: IteratorResult<T>) => void)[] = [];
  private done = false;
  private resolveResult!: (r: R) => void;
  private rejectResult!: (e: any) => void;
  private readonly resultPromise: Promise<R>;

  constructor(
    private readonly isComplete: (event: T) => boolean = () => false,
    private readonly extractResult?: (event: T) => R,
  ) {
    this.resultPromise = new Promise<R>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
    // avoid unhandled rejection when nobody awaits result()
    this.resultPromise.catch(() => { });
  }

  push(event: T) {
    if (this.done) return;
    const waiter = this.waiting.shift();
    if (waiter) {
      waiter({ value: event, done: false });
    } else {
      this.queue.push(event);
    }
    if (this.isComplete(event)) {
      this.finish(this.extractResult ? this.extractResult(event) : (undefined as R));
    }
  }

  end(result?: R) {
    this.finish(result as R);
  }

  fail(err: any) {
    if (this.done) return;
    this.done = true;
    this.rejectResult(err);
    this.flushWaiters();
  }

  result(): Promise<R> {
    return this.resultPromise;
  }

  private finish(result: R) {
    if (this.done) return;
    this.done = true;
    this.resolveResult(result);
    this.flushWaiters();
  }

  private flushWaiters() {
    for (const waiter of this.waiting.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.queue.length) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }
        if (this.done) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise((resolve) => this.waiting.push(resolve));
      },
    };
  }
}
