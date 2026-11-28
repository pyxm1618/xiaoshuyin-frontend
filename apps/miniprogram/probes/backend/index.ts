import { createTransport } from '../../transport/index';

interface Line {
  label: string;
  value: string;
}

interface ProbeData {
  baseUrl: string;
  running: boolean;
  lines: Line[];
}

interface CaseResult {
  name: string;
  pass: boolean;
  detail: string;
}

function normalizeBase(input: string): string {
  let base = input.trim().replace(/\/+$/, '');
  if (base && base.indexOf('://') < 0) base = `http://${base}`;
  return base;
}

function statusOf(result: object): string {
  const status = (result as { status?: unknown }).status;
  return typeof status === 'number' ? String(status) : '-';
}

Page({
  data: {
    baseUrl: 'http://192.168.2.135:8788',
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
      const transport = createTransport({ baseUrl: base });

      const login = await transport.request('/api/v1/auth/wechat', 'post', {
        body: { code: 'fe001-t010-synthetic' },
      });
      let token: string | undefined;
      if (login.kind === 'data' && login.status === 200) {
        const candidate = login.data.sessionToken;
        if (typeof candidate === 'string' && candidate.length > 0) token = candidate;
        results.push(
          this.record(
            'login with synthetic account',
            token !== undefined,
            `kind=data status=200 account=${login.data.accountId} token=${token ? 'issued' : 'missing'}`,
          ),
        );
      } else {
        results.push(
          this.record('login with synthetic account', false, `kind=${login.kind} status=${statusOf(login)}`),
        );
      }

      if (token) {
        const me = await transport.request('/api/v1/me', 'get', { bearerToken: token });
        if (me.kind === 'data' && me.status === 200) {
          const ok = me.data.account.status === 'ACTIVE' && typeof me.data.person.id === 'string';
          results.push(
            this.record(
              'GET /api/v1/me with credential',
              ok,
              `kind=data status=200 accountStatus=${me.data.account.status} account=${me.data.account.id} person=${me.data.person.id}`,
            ),
          );
        } else {
          results.push(
            this.record('GET /api/v1/me with credential', false, `kind=${me.kind} status=${statusOf(me)}`),
          );
        }
      } else {
        results.push(this.record('GET /api/v1/me with credential', false, 'no session token issued'));
      }

      const anonymous = await transport.request('/api/v1/me', 'get');
      const anonymousOk =
        anonymous.kind === 'http' &&
        anonymous.status === 401 &&
        anonymous.error.code === 'UNAUTHENTICATED';
      results.push(
        this.record(
          'GET /api/v1/me without credential',
          anonymousOk,
          `kind=${anonymous.kind} status=${statusOf(anonymous)}${
            anonymous.kind === 'http' ? ` code=${anonymous.error.code}` : ''
          }`,
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
    } catch (error) {
      this.push('FAIL', error instanceof Error ? error.message : String(error));
    } finally {
      this.setData({ running: false });
    }
  },
});