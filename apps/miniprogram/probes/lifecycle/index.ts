import { createTransport } from '../../transport/index';
import type { Platform } from '../../transport/index';
import { createRequestOwner } from '../../transport/lifecycle';

interface Line {
  label: string;
  value: string;
}

interface ProbeData {
  baseUrl: string;
  running: boolean;
  lines: Line[];
}

interface SpyStats {
  success: number;
  fail: number;
  aborts: number;
}

interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spyingPlatform(stats: SpyStats): Platform {
  return {
    request(options) {
      const init: WechatMiniprogram.RequestOption = {
        url: options.url,
        method: options.method as NonNullable<WechatMiniprogram.RequestOption['method']>,
        responseType: 'text',
        header: options.header,
        success(result) {
          stats.success += 1;
          options.success({
            statusCode: result.statusCode,
            data: result.data,
            header: result.header as Record<string, unknown>,
          });
        },
        fail(error) {
          stats.fail += 1;
          options.fail({ errMsg: error.errMsg });
        },
      };
      if (options.data !== undefined) init.data = options.data;
      if (options.timeout !== undefined) init.timeout = options.timeout;
      const task = wx.request(init);
      return {
        abort() {
          stats.aborts += 1;
          task.abort();
        },
      };
    },
  };
}

function controlMode(baseUrl: string, mode: string, delayMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl}/probe-mode?mode=${encodeURIComponent(mode)}&ms=${delayMs}`,
      method: 'GET',
      success: () => resolve(),
      fail: (error) => reject(new Error(error.errMsg)),
    });
  });
}

function normalizeBase(input: string): string {
  let base = input.trim().replace(/\/+$/, '');
  if (base && base.indexOf('://') < 0) base = `http://${base}`;
  return base;
}

Page({
  data: {
    baseUrl: 'http://192.168.2.135:8791',
    running: false,
    lines: [],
  } as ProbeData,

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
    const base = normalizeBase(this.data.baseUrl);
    if (!base) {
      this.push('FAIL', 'base URL is empty');
      return;
    }
    this.setData({ running: true, lines: [] });
    const results: CaseResult[] = [];
    try {
      results.push(await this.caseData(base));
      results.push(await this.caseHttp(base));
      results.push(await this.caseNetwork());
      results.push(await this.caseTimeout(base));
      results.push(await this.caseOwnerEnd(base));
      results.push(await this.caseLateHttp(base));
      results.push(await this.caseSingleSettlement(base));
    } catch (error) {
      this.push('probe error', String(error));
    }
    const summary = {
      sdk: wx.getAppBaseInfo().SDKVersion,
      platform: wx.getDeviceInfo().platform,
      model: wx.getDeviceInfo().model,
      baseUrl: base,
      passed: results.filter((result) => result.pass).length,
      total: results.length,
      results,
    };
    this.push('summary', JSON.stringify(summary));
    this.setData({ running: false });
    wx.request({
      url: `${base}/results`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: JSON.stringify(summary),
      success: () => this.push('results upload', 'sent'),
      fail: (error) => this.push('results upload', `failed ${error.errMsg}`),
    });
  },

  async caseData(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'ok', 2500);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', {
      bearerToken: 'probe-synthetic-token',
      timeoutMs: 5000,
    });
    const pass = result.kind === 'data' && result.status === 200 && result.data.account.status === 'ACTIVE';
    return this.record(
      'transport data 200',
      pass,
      `kind=${result.kind} status=${result.kind === 'data' ? result.status : '-'} success=${stats.success} fail=${stats.fail} abort=${stats.aborts}`,
    );
  },

  async caseHttp(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'unauthorized', 2500);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', { timeoutMs: 5000 });
    const pass = result.kind === 'http' && result.status === 401 && result.error.code === 'UNAUTHENTICATED' && result.data === undefined;
    return this.record(
      'transport http 401',
      pass,
      `kind=${result.kind} status=${result.kind === 'http' ? result.status : '-'} code=${result.kind === 'http' ? result.error.code : '-'} abort=${stats.aborts}`,
    );
  },

  async caseNetwork(): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    const transport = createTransport({ baseUrl: 'http://127.0.0.1:1', platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', { timeoutMs: 3000 });
    const pass = result.kind === 'network' && stats.fail >= 1 && stats.success === 0;
    return this.record('transport network', pass, `kind=${result.kind} success=${stats.success} fail=${stats.fail}`);
  },

  async caseTimeout(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'slow', 2600);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', { timeoutMs: 700 });
    const settled = { ...stats };
    await wait(2900);
    const late = { ...stats };
    const pass = result.kind === 'timeout' && settled.aborts === 1;
    return this.record(
      'transport timeout + late success isolation',
      pass,
      `kind=${result.kind} abort=${settled.aborts} lateSuccess=${late.success - settled.success} lateFail=${late.fail - settled.fail}`,
    );
  },

  async caseOwnerEnd(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'slow', 3200);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const owner = createRequestOwner();
    const pending = transport.request('/api/v1/me', 'get', { signal: owner.signal, timeoutMs: 10000 });
    setTimeout(() => owner.cancel(), 300);
    const result = await pending;
    const settled = { ...stats };
    await wait(3300);
    const late = { ...stats };
    const pass = result.kind === 'cancelled' && owner.active === false && settled.aborts === 1;
    return this.record(
      'owner end cancel + late success isolation',
      pass,
      `kind=${result.kind} ownerActive=${owner.active} abort=${settled.aborts} lateSuccess=${late.success - settled.success} lateFail=${late.fail - settled.fail}`,
    );
  },

  async caseLateHttp(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'slow-unauthorized', 2600);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', { timeoutMs: 700 });
    const settled = { ...stats };
    await wait(2900);
    const late = { ...stats };
    const pass = result.kind === 'timeout' && settled.aborts === 1;
    return this.record(
      'timeout + late http error isolation',
      pass,
      `kind=${result.kind} abort=${settled.aborts} lateSuccess=${late.success - settled.success} lateFail=${late.fail - settled.fail}`,
    );
  },

  async caseSingleSettlement(base: string): Promise<CaseResult> {
    const stats: SpyStats = { success: 0, fail: 0, aborts: 0 };
    await controlMode(base, 'ok', 2500);
    const transport = createTransport({ baseUrl: base, platform: spyingPlatform(stats) });
    const result = await transport.request('/api/v1/me', 'get', { timeoutMs: 5000 });
    const pass = result.kind === 'data' && stats.success === 1 && stats.fail === 0 && stats.aborts === 0;
    return this.record('single terminal settlement', pass, `kind=${result.kind} success=${stats.success} fail=${stats.fail} abort=${stats.aborts}`);
  },
});