// DevTools compiles app TypeScript without class-field downleveling, so this
// probe bridge uses constructor functions with per-instance methods only.

interface ProbeHeadersApi {
  get(name: string): string | null;
  set(name: string, value: string): void;
  append(name: string, value: string): void;
  delete(name: string): void;
  has(name: string): boolean;
  entries(): IterableIterator<[string, string]>;
}

export interface ProbeAbortSignalApi {
  aborted: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface ProbeRequestInit {
  method?: string;
  headers?: Record<string, string> | ProbeHeadersApi;
  body?: unknown;
  signal?: ProbeAbortSignalApi;
  redirect?: string;
}

export interface ProbeRequestApi {
  url: string;
  method: string;
  headers: ProbeHeadersApi;
  body?: unknown;
  signal?: ProbeAbortSignalApi;
  redirect?: string;
}

export interface ProbeResponseApi {
  status: number;
  statusText: string;
  ok: boolean;
  headers: ProbeHeadersApi;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

function isHeaders(value: Record<string, string> | ProbeHeadersApi): value is ProbeHeadersApi {
  return typeof (value as { entries?: unknown }).entries === 'function';
}

function headersInit(this: ProbeHeadersApi, init?: Record<string, string> | ProbeHeadersApi): void {
  const store = new Map<string, string>();
  if (init) {
    if (isHeaders(init)) {
      for (const [name, value] of init.entries()) store.set(name, value);
    } else {
      for (const name of Object.keys(init)) store.set(name.toLowerCase(), init[name] as string);
    }
  }
  this.get = (name) => {
    const value = store.get(name.toLowerCase());
    return value === undefined ? null : value;
  };
  this.set = (name, value) => {
    store.set(name.toLowerCase(), value);
  };
  this.append = (name, value) => {
    const key = name.toLowerCase();
    const current = store.get(key);
    store.set(key, current === undefined ? value : `${current}, ${value}`);
  };
  this.delete = (name) => {
    store.delete(name.toLowerCase());
  };
  this.has = (name) => store.has(name.toLowerCase());
  this.entries = () => store.entries();
}

export const ProbeHeaders = headersInit as unknown as {
  new (init?: Record<string, string> | ProbeHeadersApi): ProbeHeadersApi;
};

function requestInit(this: ProbeRequestApi, url: string, init?: ProbeRequestInit): void {
  this.url = url;
  const initValue = init || {};
  this.method = (initValue.method || 'GET').toUpperCase();
  const headers = initValue.headers;
  this.headers = headers && isHeaders(headers) ? headers : new ProbeHeaders(headers);
  this.body = initValue.body;
  if (initValue.signal) this.signal = initValue.signal;
  if (initValue.redirect) this.redirect = initValue.redirect;
}

export const ProbeRequest = requestInit as unknown as {
  new (url: string, init?: ProbeRequestInit): ProbeRequestApi;
};

interface ProbeResponseInit {
  status: number;
  statusText?: string;
  headers?: Record<string, string>;
}

function responseInit(this: ProbeResponseApi, bodyText: string, init: ProbeResponseInit): void {
  this.status = init.status;
  this.statusText = init.statusText === undefined ? '' : init.statusText;
  this.ok = init.status >= 200 && init.status < 300;
  this.headers = new ProbeHeaders(init.headers);
  this.text = () => Promise.resolve(bodyText);
  this.json = () => Promise.resolve(JSON.parse(bodyText) as unknown);
}

export const ProbeResponse = responseInit as unknown as {
  new (bodyText: string, init: ProbeResponseInit): ProbeResponseApi;
};

interface ProbeAbortControllerApi {
  signal: ProbeAbortSignalApi;
  abort(): void;
}

function controllerInit(this: ProbeAbortControllerApi): void {
  const listeners: Array<() => void> = [];
  let aborted = false;
  const signal: ProbeAbortSignalApi = {
    aborted: false,
    addEventListener: (type, listener) => {
      if (type === 'abort') listeners.push(listener);
    },
    removeEventListener: (type, listener) => {
      if (type !== 'abort') return;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  Object.defineProperty(signal, 'aborted', { get: () => aborted });
  this.signal = signal;
  this.abort = () => {
    if (aborted) return;
    aborted = true;
    for (const listener of listeners.slice()) listener();
  };
}

export const ProbeAbortController = controllerInit as unknown as {
  new (): ProbeAbortControllerApi;
};

function abortError(): Error {
  const error = new Error('The request was aborted');
  error.name = 'AbortError';
  return error;
}

type ProbeMethod = 'OPTIONS' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT';

export function createWxFetch(): (request: ProbeRequestApi) => Promise<ProbeResponseApi> {
  return function wxFetch(request: ProbeRequestApi): Promise<ProbeResponseApi> {
    return new Promise<ProbeResponseApi>((resolve, reject) => {
      const header: Record<string, string> = {};
      for (const [name, value] of request.headers.entries()) header[name] = value;
      let settled = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        fn();
      };
      const task = wx.request({
        url: request.url,
        method: request.method as ProbeMethod,
        header,
        responseType: 'text',
        success(result) {
          settle(() => resolve(new ProbeResponse(String(result.data), {
            status: result.statusCode,
            headers: result.header as Record<string, string>,
          })));
        },
        fail(error) {
          settle(() => reject(Object.assign(new Error(`WX_REQUEST_FAIL ${error.errMsg}`), { name: 'NetworkError' })));
        },
      });
      const signal = request.signal;
      if (!signal) return;
      if (signal.aborted) {
        task.abort();
        settle(() => reject(abortError()));
        return;
      }
      signal.addEventListener('abort', () => {
        task.abort();
        settle(() => reject(abortError()));
      });
    });
  };
}

export interface RuntimeGlobalsReport {
  native: Record<string, string>;
  injected: string[];
}

const PROBED_GLOBALS = ['fetch', 'Headers', 'Request', 'Response', 'URL', 'AbortController', 'FormData', 'TextDecoder'];

export function describeRuntimeGlobals(): RuntimeGlobalsReport {
  const native: Record<string, string> = {};
  for (const name of PROBED_GLOBALS) native[name] = typeof Reflect.get(globalThis, name);
  return { native, injected: [] };
}

export function installProbeGlobals(report: RuntimeGlobalsReport): void {
  if (report.native.Headers === 'undefined') {
    Object.defineProperty(globalThis, 'Headers', { value: ProbeHeaders, configurable: true, writable: true });
    report.injected.push('Headers');
  }
  if (report.native.Request === 'undefined') {
    Object.defineProperty(globalThis, 'Request', { value: ProbeRequest, configurable: true, writable: true });
    report.injected.push('Request');
  }
  if (report.native.Response === 'undefined') {
    Object.defineProperty(globalThis, 'Response', { value: ProbeResponse, configurable: true, writable: true });
    report.injected.push('Response');
  }
}
