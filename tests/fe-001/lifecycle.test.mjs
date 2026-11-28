import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRequestOwner, runOwnedRequest } from '../../apps/miniprogram/transport/lifecycle';

afterEach(() => {
  vi.useRealTimers();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('request ownership', () => {
  test('2xx with data settles as data', async () => {
    const owner = createRequestOwner();
    const me = { account: { id: 'a' }, person: { id: 'p' } };
    await expect(
      runOwnedRequest({
        owner,
        timeoutMs: 1000,
        execute: async () => ({ status: 200, data: me, error: undefined }),
      }),
    ).resolves.toEqual({ kind: 'data', status: 200, data: me, error: undefined });
    expect(owner.active).toBe(false);
  });

  test('non-2xx with error settles as http and preserves status', async () => {
    const owner = createRequestOwner();
    const error = { code: 'UNAUTHENTICATED', message: 'not signed in' };
    await expect(
      runOwnedRequest({
        owner,
        timeoutMs: 1000,
        execute: async () => ({ status: 401, data: undefined, error }),
      }),
    ).resolves.toEqual({ kind: 'http', status: 401, error, data: undefined });
  });

  test('2xx without data is not success', async () => {
    const owner = createRequestOwner();
    await expect(
      runOwnedRequest({
        owner,
        timeoutMs: 1000,
        execute: async () => ({ status: 200, data: undefined, error: undefined }),
      }),
    ).resolves.toEqual({ kind: 'invalid' });
  });

  test('rejection settles as network', async () => {
    const owner = createRequestOwner();
    await expect(
      runOwnedRequest({
        owner,
        timeoutMs: 1000,
        execute: async () => {
          throw new TypeError('network down');
        },
      }),
    ).resolves.toEqual({ kind: 'network' });
  });

  test('timeout settles once, signals cancellation, and ignores the late success response', async () => {
    vi.useFakeTimers();
    const owner = createRequestOwner();
    const pending = deferred();
    const cancels = [];
    const result = runOwnedRequest({
      owner,
      timeoutMs: 250,
      execute: async (signal) => {
        signal.subscribe(() => cancels.push(signal.cancelled));
        return pending.promise;
      },
    });
    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toEqual({ kind: 'timeout' });
    expect(cancels).toEqual([true]);
    expect(owner.active).toBe(false);
    pending.resolve({ status: 200, data: { late: true }, error: undefined });
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ kind: 'timeout' });
  });

  test('timeout ignores a late failure response', async () => {
    vi.useFakeTimers();
    const owner = createRequestOwner();
    const pending = deferred();
    const result = runOwnedRequest({ owner, timeoutMs: 250, execute: async () => pending.promise });
    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toEqual({ kind: 'timeout' });
    pending.reject(new Error('late network failure'));
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toEqual({ kind: 'timeout' });
  });

  test('cancel settles as cancelled and ignores the late success response', async () => {
    const owner = createRequestOwner();
    const pending = deferred();
    const result = runOwnedRequest({ owner, timeoutMs: 1000, execute: async () => pending.promise });
    owner.cancel();
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
    pending.resolve({ status: 200, data: { late: true }, error: undefined });
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
  });

  test('cancel ignores a late failure response', async () => {
    const owner = createRequestOwner();
    const pending = deferred();
    const result = runOwnedRequest({ owner, timeoutMs: 1000, execute: async () => pending.promise });
    owner.cancel();
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
    pending.reject(new Error('late network failure'));
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
  });

  test('an owner that already ended does not execute', async () => {
    const owner = createRequestOwner();
    owner.cancel();
    let executed = false;
    await expect(
      runOwnedRequest({
        owner,
        timeoutMs: 1000,
        execute: async () => {
          executed = true;
          return { status: 200, data: 1, error: undefined };
        },
      }),
    ).resolves.toEqual({ kind: 'cancelled' });
    expect(executed).toBe(false);
  });

  test('cancellation listeners can unsubscribe before the terminal event', () => {
    const owner = createRequestOwner();
    let unsubscribed = 0;
    let subscribed = 0;
    owner.signal.subscribe(() => {
      unsubscribed += 1;
    })();
    owner.signal.subscribe(() => {
      subscribed += 1;
    });
    owner.cancel();
    expect(unsubscribed).toBe(0);
    expect(subscribed).toBe(1);
  });

  test('the timeout timer is cleared after settlement', async () => {
    vi.useFakeTimers();
    const owner = createRequestOwner();
    await runOwnedRequest({
      owner,
      timeoutMs: 5000,
      execute: async () => ({ status: 200, data: 1, error: undefined }),
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('owner end invalidates an in-flight request and suppresses the late success', async () => {
    const owner = createRequestOwner();
    const pending = deferred();
    const result = runOwnedRequest({ owner, timeoutMs: 5000, execute: async () => pending.promise });
    owner.cancel();
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
    expect(owner.active).toBe(false);
    pending.resolve({ status: 200, data: { late: true }, error: undefined });
    await Promise.resolve();
    await expect(result).resolves.toEqual({ kind: 'cancelled' });
  });

  test('a second owner cannot inherit an ended owner generation', async () => {
    const first = createRequestOwner();
    first.cancel();
    const second = createRequestOwner();
    await expect(
      runOwnedRequest({
        owner: second,
        timeoutMs: 1000,
        execute: async () => ({ status: 200, data: 1, error: undefined }),
      }),
    ).resolves.toEqual({ kind: 'data', status: 200, data: 1, error: undefined });
  });
});