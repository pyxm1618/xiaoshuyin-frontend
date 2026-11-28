import { createChunkProbe } from '../chunk';
import type { ChunkReport } from '../chunk';

interface Line {
  label: string;
  value: string;
}

interface ProbeData {
  probeVersion: string;
  baseUrl: string;
  running: boolean;
  lines: Line[];
  hideAt: number;
  showAt: number;
}

interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

interface StreamResult {
  report: ChunkReport;
  failed: boolean;
  errMsg: string;
  dataLength: number;
  timedOut: boolean;
}

function normalizeBase(input: string): string {
  let base = input.trim().replace(/\/+$/, '');
  if (base && base.indexOf('://') < 0) base = `http://${base}`;
  return base;
}

function spanOf(report: ChunkReport): number {
  return report.firstArrivalMs !== null && report.lastArrivalMs !== null
    ? report.lastArrivalMs - report.firstArrivalMs
    : 0;
}

function maxGapOf(report: ChunkReport): number {
  let gap = 0;
  for (let i = 1; i < report.chunks.length; i += 1) {
    const current = report.chunks[i];
    const previous = report.chunks[i - 1];
    if (current && previous) gap = Math.max(gap, current.arrivedAtMs - previous.arrivedAtMs);
  }
  return gap;
}

function stream(url: string, options: { waitMs: number; abortAfterMs?: number }): Promise<StreamResult> {
  return new Promise((resolve) => {
    const probe = createChunkProbe(() => Date.now());
    let settled = false;
    let dataLength = 0;
    let failed = false;
    let errMsg = '';
    let timedOut = false;
    let abortTimer: ReturnType<typeof setTimeout> | undefined;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (cancelled: boolean): void => {
      if (settled) return;
      settled = true;
      if (abortTimer !== undefined) clearTimeout(abortTimer);
      if (waitTimer !== undefined) clearTimeout(waitTimer);
      const report = cancelled ? probe.cancel() : probe.complete();
      resolve({ report, failed, errMsg, dataLength, timedOut });
    };

    const task = wx.request({
      url,
      method: 'GET',
      enableChunked: true,
      responseType: 'text',
      timeout: options.waitMs + 10000,
      success(res) {
        if (settled) return;
        dataLength = typeof res.data === 'string' ? res.data.length : 0;
        finish(false);
      },
      fail(error) {
        if (settled) return;
        failed = true;
        errMsg = error.errMsg;
        finish(true);
      },
    });

    task.onChunkReceived((res) => {
      if (!settled) probe.onChunk(res.data);
    });

    if (options.abortAfterMs !== undefined) {
      abortTimer = setTimeout(() => {
        if (settled) return;
        task.abort();
        finish(true);
      }, options.abortAfterMs);
    }

    waitTimer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      task.abort();
      finish(true);
    }, options.waitMs);
  });
}

Page({
  data: {
    baseUrl: 'http://192.168.2.135:8791',
    running: false,
    lines: [],
    hideAt: 0,
    showAt: 0,
    probeVersion: 't012-v2',
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

  onHide(): void {
    this.setData({ hideAt: Date.now() });
  },

  onShow(): void {
    if (this.data.hideAt > 0) this.setData({ showAt: Date.now() });
  },

  async onRun(): Promise<void> {
    if (this.data.running) return;
    const base = normalizeBase(this.data.baseUrl);
    if (!base) {
      this.push('FAIL', 'base URL is empty');
      return;
    }
    this.setData({ running: true, lines: [], hideAt: 0, showAt: 0 });
    const results: CaseResult[] = [];
    try {
      const chunked = await stream(`${base}/chunks?count=6&interval=400`, { waitMs: 8000 });
      const chunkSpan = spanOf(chunked.report);
      results.push(
        this.record(
          'chunked stream',
          chunked.report.completed &&
            chunked.report.chunks.length >= 2 &&
            chunkSpan >= 800 &&
            chunked.report.totalBytes > 0,
          `chunks=${chunked.report.chunks.length} bytes=${chunked.report.totalBytes} spanMs=${chunkSpan} completed=${chunked.report.completed} failed=${chunked.failed}`,
        ),
      );

      const buffered = await stream(`${base}/buffered?count=6&interval=400`, { waitMs: 8000 });
      const bufferedSpan = spanOf(buffered.report);
      results.push(
        this.record(
          'buffered control',
          buffered.report.completed && (buffered.report.chunks.length <= 1 || bufferedSpan <= 600),
          `chunks=${buffered.report.chunks.length} bytes=${buffered.report.totalBytes} spanMs=${bufferedSpan} dataLength=${buffered.dataLength} completed=${buffered.report.completed}`,
        ),
      );

      const cancelled = await stream(`${base}/chunks?count=20&interval=500`, {
        waitMs: 6000,
        abortAfterMs: 1200,
      });
      results.push(
        this.record(
          'cancel mid-stream',
          cancelled.report.cancelled &&
            !cancelled.report.completed &&
            cancelled.report.chunks.length >= 1 &&
            cancelled.report.chunks.length < 20,
          `chunks=${cancelled.report.chunks.length} cancelled=${cancelled.report.cancelled} completed=${cancelled.report.completed} failed=${cancelled.failed}`,
        ),
      );

      this.push('background switch', 'place the app in background for about 3 seconds now, then return');
      const background = await stream(`${base}/chunks?count=40&interval=500`, { waitMs: 30000 });
      const hideAt = this.data.hideAt;
      const showAt = this.data.showAt;
      const backgroundSpan = spanOf(background.report);
      const chunksBeforeHide = background.report.chunks.filter((c) => hideAt > 0 && c.arrivedAtMs < hideAt).length;
      const chunksAfterResume = background.report.chunks.filter((c) => showAt > 0 && c.arrivedAtMs > showAt).length;
      results.push(
        this.record(
          'background switch',
          hideAt > 0 &&
            showAt > 0 &&
            (background.report.completed || background.report.cancelled),
          `hidden=${hideAt > 0} resumed=${showAt > 0} hiddenMs=${showAt > 0 ? showAt - hideAt : 0} chunks=${background.report.chunks.length} beforeHide=${chunksBeforeHide} afterResume=${chunksAfterResume} spanMs=${backgroundSpan} completed=${background.report.completed} cancelled=${background.report.cancelled} failed=${background.failed}`,
        ),
      );

      this.push('network switch', 'turn Wi-Fi off for about 3 seconds now, then turn it back on');
      const network = await stream(`${base}/chunks?count=40&interval=500`, { waitMs: 30000 });
      const networkGap = maxGapOf(network.report);
      results.push(
        this.record(
          'network switch',
          network.failed || networkGap >= 1500,
          `chunks=${network.report.chunks.length} maxGapMs=${networkGap} failed=${network.failed} errMsg=${network.errMsg || '-'} completed=${network.report.completed} cancelled=${network.report.cancelled}`,
        ),
      );

      const info = wx.getAppBaseInfo();
      const summary = {
        sdk: info.SDKVersion,
        platform: wx.getDeviceInfo().platform,
        model: wx.getDeviceInfo().model,
        baseUrl: base,
        passed: results.filter((r) => r.pass).length,
        total: results.length,
        results,
      };
      this.push('summary', JSON.stringify(summary));
      wx.request({
        url: `${base}/results`,
        method: 'POST',
        data: JSON.stringify(summary),
        header: { 'content-type': 'application/json' },
        success: () => this.push('results upload', 'sent'),
        fail: (error) => this.push('results upload', error.errMsg),
      });
    } catch (error) {
      this.push('FAIL', error instanceof Error ? error.message : String(error));
    } finally {
      this.setData({ running: false });
    }
  },
});