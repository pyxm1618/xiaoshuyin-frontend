import createClient from 'openapi-fetch';
import {
  ProbeAbortController,
  createWxFetch,
  describeRuntimeGlobals,
  installProbeGlobals,
} from './bridge';

interface ProbeOperation {
  get: {
    responses: {
      200: { content: { 'application/json': { probe?: boolean } } };
      401: { content: { 'application/json': { code?: string; message?: string } } };
    };
  };
}

type ProbePaths = { [path: string]: ProbeOperation };

interface Line {
  label: string;
  value: string;
}

interface RuntimeData {
  baseUrl: string;
  running: boolean;
  lines: Line[];
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

Page({
  data: {
    baseUrl: 'http://192.168.2.135:8791',
    running: false,
    lines: [],
  } as RuntimeData,

  onLoad(): void {
    const info = wx.getAppBaseInfo();
    this.push('runtime', `SDK ${info.SDKVersion} / ${wx.getDeviceInfo().platform}`);
  },

  onBaseUrlInput(event: WechatMiniprogram.Input): void {
    this.setData({ baseUrl: event.detail.value });
  },

  push(label: string, value: string): void {
    this.setData({ lines: this.data.lines.concat([{ label, value }]) });
  },

  async onRun(): Promise<void> {
    if (this.data.running) return;
    this.setData({ running: true, lines: [] });
    try {
      await this.runProbe();
    } finally {
      this.setData({ running: false });
      this.push('done', 'probe finished');
    }
  },

  async runProbe(): Promise<void> {
    const globals = describeRuntimeGlobals();
    this.push('native globals', JSON.stringify(globals.native));
    installProbeGlobals(globals);
    this.push('injected globals', globals.injected.length ? globals.injected.join(', ') : 'none');

    const baseUrl = this.data.baseUrl.trim().replace(/\/+$/, '');
    if (!baseUrl) {
      this.push('FAIL', 'base URL is empty');
      return;
    }

    // The wx bridge satisfies openapi-fetch's Fetch contract only for this probe.
    const client = createClient<ProbePaths>({
      baseUrl,
      fetch: createWxFetch() as unknown as typeof fetch,
    });

    try {
      const ok = await client.GET('/ok');
      this.push('GET /ok', `status ${ok.response.status}, data ${JSON.stringify(ok.data)}`);
      this.push('GET /ok verdict', ok.response.status === 200 && !!ok.data && ok.data.probe === true ? 'PASS' : 'FAIL');
    } catch (error) {
      this.push('GET /ok', `FAIL ${errorText(error)}`);
    }

    try {
      const unauthorized = await client.GET('/unauthorized');
      this.push('GET /unauthorized', `status ${unauthorized.response.status}, error ${JSON.stringify(unauthorized.error)}`);
      this.push('GET /unauthorized verdict',
        unauthorized.response.status === 401 && !!unauthorized.error && unauthorized.error.code === 'UNAUTHENTICATED' ? 'PASS' : 'FAIL');
    } catch (error) {
      this.push('GET /unauthorized', `FAIL ${errorText(error)}`);
    }

    try {
      await client.GET('/ok', { baseUrl: 'http://127.0.0.1:1' });
      this.push('network rejection', 'FAIL resolved unexpectedly');
    } catch (error) {
      this.push('network rejection', `PASS rejected: ${errorText(error)}`);
    }

    try {
      const controller = new ProbeAbortController();
      // ProbeAbortSignal is the platform boundary; openapi-fetch types only the DOM signal.
      const signal = controller.signal as unknown as AbortSignal;
      const pending = client.GET('/slow', { signal });
      setTimeout(() => controller.abort(), 300);
      await pending;
      this.push('cancel', 'FAIL resolved despite abort');
    } catch (error) {
      const text = errorText(error);
      this.push('cancel', text.indexOf('AbortError') >= 0 ? `PASS rejected: ${text}` : `FAIL ${text}`);
    }
  },
});
