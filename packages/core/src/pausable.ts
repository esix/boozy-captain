export type PausableState = "running" | "paused" | "cancelled" | "done";

export interface Pausable<T> extends AsyncIterableIterator<T> {
  pause(): void;
  resume(): void;
  cancel(): void;
  readonly state: PausableState;
}

/**
 * Wrap an AsyncIterable with explicit pause/resume/cancel.
 *
 * Pause is honored on the *next* pull: the wrapper waits on an internal
 * resume signal before forwarding `iterator.next()` to the source.
 * That preserves backpressure — if the consumer never resumes, the source
 * never produces.
 */
export function pausable<T>(source: AsyncIterable<T>): Pausable<T> {
  const it = source[Symbol.asyncIterator]();
  const ctl: { state: PausableState } = { state: "running" };
  const getState = (): PausableState => ctl.state;
  let resumeResolve: (() => void) | null = null;
  let resumePromise: Promise<void> = Promise.resolve();

  const waitForResume = (): void => {
    resumePromise = new Promise<void>((resolve) => {
      resumeResolve = resolve;
    });
  };

  const wrapper: Pausable<T> = {
    get state() {
      return ctl.state;
    },
    pause(): void {
      if (getState() === "running") {
        ctl.state = "paused";
        waitForResume();
      }
    },
    resume(): void {
      if (getState() === "paused") {
        ctl.state = "running";
        const fn = resumeResolve;
        resumeResolve = null;
        if (fn) fn();
      }
    },
    cancel(): void {
      const s = getState();
      if (s === "cancelled" || s === "done") return;
      ctl.state = "cancelled";
      const fn = resumeResolve;
      resumeResolve = null;
      if (fn) fn();
      void it.return?.(undefined);
    },
    async next(): Promise<IteratorResult<T>> {
      if (getState() === "cancelled" || getState() === "done") {
        return { done: true, value: undefined };
      }
      if (getState() === "paused") {
        await resumePromise;
      }
      if (getState() === "cancelled") {
        return { done: true, value: undefined };
      }
      const r = await it.next();
      if (r.done && getState() !== "cancelled") ctl.state = "done";
      return r;
    },
    async return(value?: unknown): Promise<IteratorResult<T>> {
      ctl.state = "cancelled";
      await it.return?.(value);
      return { done: true, value: undefined };
    },
    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
      return wrapper;
    },
  };

  return wrapper;
}
