// T005 isolated native wx.request probe. It deliberately does not import the
// transport adapter under test so the platform gate stays independent of T007.
interface Line {
  label: string;
  value: string;
}

interface ProbeData {
  baseUrl: string;
  running: boolean;
  lines: Line[];
}

interface Outcome {
  name: string;
  settled: number;
  callbacks: string[];
  status: number | null;
  bodyText: string;
  responseProbe: string | null;
  errMsg: string | null;
  lateSuccess: boolean;
  lateFail: boolean;
  durationMs: number;
}

interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch (error) {
    return String(value);
  }
}

function field(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key)) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function bodyText(value: unknown): string {
  if (typeof value === 'string') return value;
  return text(value);
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
    } catch (error) {
      return undefined;
    }
  }
  return undefined;
}

function probeRequest(
  name: string,
  options: WechatMiniprogram.RequestOption,
  abortAfterMs?: number,
  observeMs?: number,
): Promise<Outcome> {
  return new Promise((resolve) => {
    const started = Date.now();
    const callbacks: string[] = [];
    const observation = observeMs === undefined ? 1200 : observeMs;
    let settled = 0;
    let status: number | null = null;
    let body: unknown = undefined;
    let responseProbe: string | null = null;
    let errMsg: string | null = null;
    let lateSuccess = false;
    let lateFail = false;
    let finished = false;

    function finish(): void {
      if (finished) return;
      finished = true;
      setTimeout(() => {
        resolve({
          name,
          settled,
          callbacks,
          status,
          bodyText: bodyText(body),
          responseProbe,
          errMsg,
          lateSuccess,
          lateFail,
          durationMs: Date.now() - started,
        });
      }, observation);
    }

    const requestInit: WechatMiniprogram.RequestOption = {
      url: options.url,
      responseType: 'text',
      success(result: WechatMiniprogram.RequestSuccessCallbackResult) {
        callbacks.push('success');
        if (settled > 0) {
          lateSuccess = true;
          callbacks.push('late-success');
          return;
        }
        settled += 1;
        status = result.statusCode;
        body = result.data;
        const headers = result.header as Record<string, unknown>;
        const rawProbe = headers['x-probe'] !== undefined ? headers['x-probe'] : headers['X-Probe'];
        if (rawProbe !== undefined) responseProbe = String(rawProbe);
        finish();
      },
      fail(error: WechatMiniprogram.GeneralCallbackResult) {
        callbacks.push('fail:' + error.errMsg);
        if (settled > 0) {
          lateFail = true;
          callbacks.push('late-fail');
          return;
        }
        settled += 1;
        errMsg = error.errMsg;
        finish();
      },
      complete() {
        callbacks.push('complete');
        if (settled === 0) callbacks.push('complete-before-terminal');
      },
    };
    if (options.method !== undefined) requestInit.method = options.method;
    if (options.header !== undefined) requestInit.header = options.header;
    if (options.data !== undefined) requestInit.data = options.data;
    if (options.timeout !== undefined) requestInit.timeout = options.timeout;

    const task = wx.request(requestInit);

    if (abortAfterMs !== undefined) {
      setTimeout(() => {
        callbacks.push('abort-called');
        task.abort();
      }, abortAfterMs);
    }
  });
}

function payloadOf(outcome: Outcome): Record<string, unknown> {
  const parsed = asObject(outcome.bodyText);
  return parsed === undefined ? {} : parsed;
}

Page({
  data: {
    baseUrl: 'http://192.168.2.135:8791',
    running: false,
    lines: [],
  } as ProbeData,

  onLoad(): void {
    const base = wx.getAppBaseInfo();
    const device = wx.getDeviceInfo();
    const lines: Line[] = [];
    lines.push({ label: 'runtime', value: 'SDK ' + base.SDKVersion + ' / ' + device.platform + ' / ' + device.model });
    lines.push({ label: 'wechat', value: 'version ' + base.version });
    this.setData({ lines });
  },

  onBaseUrlInput(event: WechatMiniprogram.Input): void {
    this.setData({ baseUrl: event.detail.value });
  },

  push(label: string, value: string): void {
    this.setData({ lines: this.data.lines.concat([{ label, value }]) });
  },

  record(name: string, pass: boolean, detail: string): CaseResult {
    this.push(name, (pass ? 'PASS ' : 'FAIL ') + detail);
    return { name, pass, detail };
  },

  async onRun(): Promise<void> {
    if (this.data.running) return;
    let base = this.data.baseUrl.trim().replace(/\/+$/, '');
    if (base && base.indexOf('://') < 0) base = 'http://' + base;
    if (!base) {
      this.push('FAIL', 'base URL is empty');
      return;
    }
    this.setData({ running: true, lines: this.data.lines.slice(0, 2) });
    const results: CaseResult[] = [];
    try {
      const ordinary = await this.runOrdinary(base);
      results.push(...ordinary);
      const failures = await this.runFailureModes(base);
      results.push(...failures);
      const patch = await this.runPatch(base);
      results.push(...patch);
    } catch (error) {
      this.push('probe error', String(error));
    }
    const passed = results.filter((result) => result.pass).length;
    const summary = {
      sdk: wx.getAppBaseInfo().SDKVersion,
      platform: wx.getDeviceInfo().platform,
      model: wx.getDeviceInfo().model,
      baseUrl: base,
      passed,
      total: results.length,
      results,
    };
    this.push('summary', text(summary));
    this.setData({ running: false });
    wx.request({
      url: base + '/results',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: text(summary),
      success: () => this.push('results upload', 'sent'),
      fail: (error) => this.push('results upload', 'failed ' + error.errMsg),
    });
  },

  async runOrdinary(base: string): Promise<CaseResult[]> {
    const results: CaseResult[] = [];

    const ok = await probeRequest('GET /ok', {
      url: base + '/ok',
      method: 'GET',
      header: { 'X-Probe-Header': 'fe-001' },
    });
    const okPayload = payloadOf(ok);
    results.push(this.record('GET /ok', ok.settled === 1 && ok.status === 200 && okPayload.probe === true && ok.responseProbe === 'ok',
      'settled=' + ok.settled + ' status=' + text(ok.status) + ' callbacks=' + ok.callbacks.join('|') + ' header=' + text(ok.responseProbe) + ' ' + ok.durationMs + 'ms'));

    const echo = await probeRequest('GET /echo', {
      url: base + '/echo?a=1&b=two',
      method: 'GET',
      header: { 'X-Probe-Header': 'fe-001' },
    });
    const echoPayload = payloadOf(echo);
    results.push(this.record('GET /echo', echo.status === 200 && echoPayload.method === 'GET' &&
      echoPayload.probeHeader === 'fe-001' && text(field(echoPayload.query, 'a')) === '1' && text(field(echoPayload.query, 'b')) === 'two',
      'status=' + text(echo.status) + ' server saw method=' + text(echoPayload.method) + ' header=' + text(echoPayload.probeHeader) + ' query=' + text(echoPayload.query)));

    const unauthorized = await probeRequest('GET /unauthorized', { url: base + '/unauthorized', method: 'GET' });
    const unauthorizedPayload = payloadOf(unauthorized);
    results.push(this.record('GET /unauthorized', unauthorized.settled === 1 && unauthorized.status === 401 && unauthorizedPayload.code === 'UNAUTHENTICATED',
      'settled=' + unauthorized.settled + ' status=' + text(unauthorized.status) + ' code=' + text(unauthorizedPayload.code) + ' callbacks=' + unauthorized.callbacks.join('|')));

    const missing = await probeRequest('GET /missing', { url: base + '/missing', method: 'GET' });
    const missingPayload = payloadOf(missing);
    results.push(this.record('GET /missing', missing.settled === 1 && missing.status === 404 && missingPayload.code === 'NOT_FOUND',
      'settled=' + missing.settled + ' status=' + text(missing.status) + ' code=' + text(missingPayload.code)));

    return results;
  },

  async runFailureModes(base: string): Promise<CaseResult[]> {
    const results: CaseResult[] = [];

    const network = await probeRequest('GET refused', { url: 'http://127.0.0.1:1/ok', method: 'GET' }, undefined, 300);
    results.push(this.record('network error', network.settled === 1 && network.status === null && network.errMsg !== null && !network.lateSuccess,
      'settled=' + network.settled + ' fail=' + text(network.errMsg) + ' callbacks=' + network.callbacks.join('|') + ' lateSuccess=' + text(network.lateSuccess)));

    const timeout = await probeRequest('GET /slow timeout', { url: base + '/slow?ms=2200', method: 'GET', timeout: 800 }, undefined, 2200);
    results.push(this.record('bounded timeout', timeout.settled === 1 && timeout.status === null &&
      timeout.errMsg !== null && timeout.errMsg.toLowerCase().indexOf('timeout') >= 0 &&
      timeout.callbacks.indexOf('complete') >= 0 && !timeout.lateSuccess,
      'settled=' + timeout.settled + ' fail=' + text(timeout.errMsg) + ' callbacks=' + timeout.callbacks.join('|') + ' lateSuccess=' + text(timeout.lateSuccess)));

    const abort = await probeRequest('GET /slow abort', { url: base + '/slow?ms=2200', method: 'GET' }, 300, 2400);
    results.push(this.record('explicit abort', abort.settled === 1 && abort.status === null && abort.errMsg !== null &&
      abort.errMsg.toLowerCase().indexOf('abort') >= 0 && abort.callbacks.indexOf('complete') >= 0 && !abort.lateSuccess,
      'settled=' + abort.settled + ' fail=' + text(abort.errMsg) + ' callbacks=' + abort.callbacks.join('|') + ' lateSuccess=' + text(abort.lateSuccess) + ' lateFail=' + text(abort.lateFail)));

    const multi = await probeRequest('GET /ok settlement', { url: base + '/ok', method: 'GET' }, undefined, 600);
    results.push(this.record('single settlement', multi.settled === 1 && multi.callbacks.filter((name) => name === 'success' || name === 'fail').length === 1,
      'settled=' + multi.settled + ' callbacks=' + multi.callbacks.join('|')));

    return results;
  },

  async runPatch(base: string): Promise<CaseResult[]> {
    const results: CaseResult[] = [];
    // Official miniprogram-api-typings 5.3.1 omits PATCH from RequestOption.method.
    // This isolated diagnostic cast exists only in the T005 probe, never in the formal transport.
    const patchMethod = 'PATCH' as unknown as NonNullable<WechatMiniprogram.RequestOption['method']>;
    const patch = await probeRequest('PATCH /method', {
      url: base + '/method',
      method: patchMethod,
      header: { 'content-type': 'application/json' },
      data: '{"probe":true}',
    }, undefined, 600);
    const patchPayload = payloadOf(patch);
    results.push(this.record('PATCH client callback', patch.status === 200 && patchPayload.observedMethod === 'PATCH',
      'status=' + text(patch.status) + ' clientObserved=' + text(patchPayload.observedMethod) + ' callbacks=' + patch.callbacks.join('|') + ' fail=' + text(patch.errMsg)));

    const observed = await probeRequest('GET /observed', { url: base + '/observed', method: 'GET' }, undefined, 400);
    const entries = payloadOf(observed).observed;
    let serverSawPatch = false;
    if (Array.isArray(entries)) {
      for (let i = 0; i < entries.length; i += 1) {
        const entry: unknown = entries[i];
        if (text(field(entry, 'method')) === 'SERVER-OBSERVED PATCH' && text(field(entry, 'path')) === '/method') serverSawPatch = true;
      }
    }
    results.push(this.record('PATCH server observation', serverSawPatch,
      'serverSawPatch=' + text(serverSawPatch) + ' observed=' + text(entries).slice(0, 400)));
    return results;
  },
});