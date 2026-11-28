/// <reference types="miniprogram-api-typings" />

export interface CancellationSignal {
  readonly cancelled: boolean;
  subscribe(listener: (cancelled: boolean) => void): () => void;
}

export interface RequestOwner {
  readonly signal: CancellationSignal;
  readonly active: boolean;
  cancel(): void;
}

export interface RequestOutcome<Data, Error> {
  status: number;
  data: Data | undefined;
  error: Error | undefined;
}

export type OwnedResult<Data, Error> =
  | { kind: 'data'; status: number; data: Data; error: undefined }
  | { kind: 'http'; status: number; error: Error; data: undefined }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'cancelled' }
  | { kind: 'invalid' };

export interface RunOwnedRequestOptions<Data, Error> {
  owner: RequestOwner;
  timeoutMs: number;
  execute: (signal: CancellationSignal) => Promise<RequestOutcome<Data, Error>>;
}

export function createRequestOwner(): RequestOwner {
  let active = true;
  const listeners = new Set<(cancelled: boolean) => void>();
  const signal: CancellationSignal = {
    get cancelled() {
      return !active;
    },
    subscribe(listener) {
      if (!active) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    get signal() {
      return signal;
    },
    get active() {
      return active;
    },
    cancel() {
      if (!active) return;
      active = false;
      const pending = [...listeners];
      listeners.clear();
      for (const listener of pending) listener(true);
    },
  };
}

export function runOwnedRequest<Data, Error>(
  options: RunOwnedRequestOptions<Data, Error>,
): Promise<OwnedResult<Data, Error>> {
  const { owner, timeoutMs, execute } = options;
  if (!owner.active) return Promise.resolve({ kind: 'cancelled' });

  return new Promise<OwnedResult<Data, Error>>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: () => void = () => {};

    const finish = (result: OwnedResult<Data, Error>): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
      resolve(result);
      owner.cancel();
    };

    unsubscribe = owner.signal.subscribe((cancelled) => {
      if (cancelled) finish({ kind: 'cancelled' });
    });

    timer = setTimeout(() => {
      finish({ kind: 'timeout' });
      owner.cancel();
    }, timeoutMs);

    let execution: Promise<RequestOutcome<Data, Error>>;
    try {
      execution = execute(owner.signal);
    } catch (error) {
      finish({ kind: 'network' });
      return;
    }

    execution.then(
      (outcome) => {
        if (settled) return;
        if (outcome.status >= 200 && outcome.status < 300) {
          if (outcome.data !== undefined) {
            finish({ kind: 'data', status: outcome.status, data: outcome.data, error: undefined });
          } else {
            finish({ kind: 'invalid' });
          }
          return;
        }
        if (outcome.error !== undefined) {
          finish({ kind: 'http', status: outcome.status, error: outcome.error, data: undefined });
          return;
        }
        finish({ kind: 'invalid' });
      },
      () => {
        finish({ kind: 'network' });
      },
    );
  });
}