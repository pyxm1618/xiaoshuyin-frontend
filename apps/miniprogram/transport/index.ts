import type { operations, paths } from '../../../packages/generated/openapi';
import { createRequestOwner, runOwnedRequest } from './lifecycle';
import type { CancellationSignal, OwnedResult, RequestOwner } from './lifecycle';

type OperationMethods<Path extends keyof paths> = {
  [Method in keyof paths[Path]]: [NonNullable<paths[Path][Method]>] extends [never]
    ? never
    : NonNullable<paths[Path][Method]> extends operations[keyof operations]
      ? Method
      : never;
}[keyof paths[Path]];

type OperationFor<Path extends keyof paths, Method extends OperationMethods<Path>> = Extract<
  NonNullable<paths[Path][Method & keyof paths[Path]]>,
  operations[keyof operations]
>;

type QueryOf<Operation> = Operation extends { parameters: { query?: infer Query } }
  ? NonNullable<Query> extends never
    ? never
    : NonNullable<Query>
  : never;

type HeaderOf<Operation> = Operation extends { parameters: { header?: infer Header } }
  ? NonNullable<Header> extends never
    ? never
    : NonNullable<Header>
  : never;

type BodyOf<Operation> = Operation extends { requestBody: { content: { 'application/json': infer Body } } }
  ? Body
  : never;

type ResponsesOf<Operation> = Operation extends { responses: infer Responses } ? Responses : never;

type StatusOf<Operation> = Extract<keyof ResponsesOf<Operation>, number>;

type SuccessStatusOf<Operation> = {
  [Status in StatusOf<Operation>]: `${Status}` extends `2${string}` ? Status : never;
}[StatusOf<Operation>];

type ErrorStatusOf<Operation> = {
  [Status in StatusOf<Operation>]: `${Status}` extends `2${string}` ? never : Status;
}[StatusOf<Operation>];

type ResponseBodyOf<Operation, Status extends number> = Status extends keyof ResponsesOf<Operation>
  ? ResponsesOf<Operation>[Status] extends { content: { 'application/json': infer Body } }
    ? Body
    : never
  : never;

type SuccessDataOf<Operation> = ResponseBodyOf<Operation, SuccessStatusOf<Operation>>;

type ErrorDataOf<Operation> = ResponseBodyOf<Operation, ErrorStatusOf<Operation>>;

export interface TransportSignal {
  readonly cancelled: boolean;
  subscribe(listener: (cancelled: boolean) => void): () => void;
}

export interface RequestOptions<Path extends keyof paths, Method extends OperationMethods<Path>> {
  query?: QueryOf<OperationFor<Path, Method>>;
  header?: HeaderOf<OperationFor<Path, Method>>;
  body?: BodyOf<OperationFor<Path, Method>>;
  bearerToken?: string;
  signal?: TransportSignal;
  timeoutMs?: number;
}

export type TransportResult<Path extends keyof paths, Method extends OperationMethods<Path>> =
  | {
      kind: 'data';
      status: SuccessStatusOf<OperationFor<Path, Method>>;
      data: SuccessDataOf<OperationFor<Path, Method>>;
      error: undefined;
    }
  | {
      kind: 'http';
      status: ErrorStatusOf<OperationFor<Path, Method>>;
      error: ErrorDataOf<OperationFor<Path, Method>>;
      data: undefined;
    }
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'cancelled' }
  | { kind: 'invalid' };

export interface Transport {
  request<Path extends keyof paths, Method extends OperationMethods<Path>>(
    path: Path,
    method: Method,
    options?: RequestOptions<Path, Method>,
  ): Promise<TransportResult<Path, Method>>;
}

export interface PlatformResponse {
  statusCode: number;
  data: unknown;
  header?: Record<string, unknown>;
}

export interface PlatformRequestOptions {
  url: string;
  method: string;
  responseType: 'text';
  header: Record<string, string>;
  data?: string;
  timeout?: number;
  success(result: PlatformResponse): void;
  fail(error: { errMsg: string }): void;
}

export interface PlatformTask {
  abort(): void;
}

export interface Platform {
  request(options: PlatformRequestOptions): PlatformTask;
}

export interface TransportConfig {
  baseUrl: string;
  platform?: Platform;
}

interface RuntimeOptions {
  query?: Record<string, unknown>;
  header?: Record<string, string>;
  body?: unknown;
  bearerToken?: string;
  signal?: TransportSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

const wechatPlatform: Platform = {
  request(options) {
    const init: WechatMiniprogram.RequestOption = {
      url: options.url,
      method: options.method as NonNullable<WechatMiniprogram.RequestOption['method']>,
      responseType: 'text',
      header: options.header,
      success: options.success,
      fail: options.fail,
    };
    if (options.data !== undefined) init.data = options.data;
    if (options.timeout !== undefined) init.timeout = options.timeout;
    return wx.request(init);
  },
};

function parseJson(body: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof body === 'string') {
    try {
      return { ok: true, value: JSON.parse(body) as unknown };
    } catch {
      return { ok: false };
    }
  }
  if (typeof body === 'object' && body !== null) return { ok: true, value: body };
  return { ok: false };
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, unknown>): string {
  const pairs: string[] = [];
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      const values: unknown[] = Array.isArray(value) ? value : [value];
      for (const item of values) pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return `${baseUrl}${path}${pairs.length > 0 ? `?${pairs.join('&')}` : ''}`;
}

function buildInit(baseUrl: string, path: string, method: string, runtime?: RuntimeOptions): PlatformRequestOptions {
  const header: Record<string, string> = {};
  if (runtime?.body !== undefined) header['content-type'] = 'application/json';
  if (runtime?.bearerToken !== undefined) header.Authorization = `Bearer ${runtime.bearerToken}`;
  if (runtime?.header !== undefined) Object.assign(header, runtime.header);

  const init: PlatformRequestOptions = {
    url: buildUrl(baseUrl, path, runtime?.query),
    method: method.toUpperCase(),
    responseType: 'text',
    header,
    success() {},
    fail() {},
  };
  if (runtime?.body !== undefined) init.data = JSON.stringify(runtime.body);
  if (runtime?.timeoutMs !== undefined) init.timeout = runtime.timeoutMs;
  return init;
}

function dispatch(
  platform: Platform,
  init: PlatformRequestOptions,
  signal: CancellationSignal,
): Promise<{ status: number; data: unknown; error: unknown }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let task: PlatformTask | undefined;
    let unsubscribe: () => void = () => {};

    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      action();
    };

    unsubscribe = signal.subscribe((cancelled) => {
      if (cancelled && task !== undefined) task.abort();
    });

    task = platform.request({
      ...init,
      success(result) {
        settle(() => {
          const parsed = parseJson(result.data);
          if (result.statusCode >= 200 && result.statusCode < 300) {
            resolve({
              status: result.statusCode,
              data: parsed.ok ? parsed.value : undefined,
              error: undefined,
            });
            return;
          }
          resolve({
            status: result.statusCode,
            data: undefined,
            error: parsed.ok ? parsed.value : undefined,
          });
        });
      },
      fail(error) {
        settle(() => {
          reject(new Error(error.errMsg));
        });
      },
    });
  });
}

// The platform returns a numeric status and unparsed JSON at runtime; these two
// narrowing points assert the generated contract's success/error shape once.
function toTransportResult<Path extends keyof paths, Method extends OperationMethods<Path>>(
  result: OwnedResult<unknown, unknown>,
): TransportResult<Path, Method> {
  if (result.kind === 'data') {
    return {
      kind: 'data',
      status: result.status as SuccessStatusOf<OperationFor<Path, Method>>,
      data: result.data as SuccessDataOf<OperationFor<Path, Method>>,
      error: undefined,
    };
  }
  if (result.kind === 'http') {
    return {
      kind: 'http',
      status: result.status as ErrorStatusOf<OperationFor<Path, Method>>,
      error: result.error as ErrorDataOf<OperationFor<Path, Method>>,
      data: undefined,
    };
  }
  return { kind: result.kind };
}

export function createTransport(config: TransportConfig): Transport {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const platform = config.platform ?? wechatPlatform;

  return {
    async request<Path extends keyof paths, Method extends OperationMethods<Path>>(
      path: Path,
      method: Method,
      options?: RequestOptions<Path, Method>,
    ): Promise<TransportResult<Path, Method>> {
      const runtime: RuntimeOptions | undefined = options;
      const init = buildInit(baseUrl, String(path), String(method), runtime);
      const owner: RequestOwner = createRequestOwner();
      const external = runtime?.signal;

      if (external?.cancelled) {
        const task = platform.request({ ...init, success() {}, fail() {} });
        task.abort();
        return { kind: 'cancelled' };
      }

      let unsubscribeExternal: () => void = () => {};
      if (external !== undefined) {
        unsubscribeExternal = external.subscribe((cancelled) => {
          if (cancelled) owner.cancel();
        });
      }

      const result = await runOwnedRequest<unknown, unknown>({
        owner,
        timeoutMs: runtime?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        execute: (signal) => dispatch(platform, init, signal),
      });
      unsubscribeExternal();
      return toTransportResult<Path, Method>(result);
    },
  };
}