import type { components, operations, paths } from '../../packages/generated/openapi';
import type { Transport } from '../../apps/miniprogram/transport/index';

declare const transport: Transport;

function acceptsMe(value: components['schemas']['MeResponse']): void {
  void value;
}

function acceptsError(value: components['schemas']['Error']): void {
  void value;
}

function acceptsCase(value: components['schemas']['CaseResponse']): void {
  void value;
}

function acceptsString(value: string | undefined): void {
  void value;
}

type Expect<T extends true> = T;
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
  ? true
  : false;
type MeData = paths['/api/v1/me']['get']['responses'][200]['content']['application/json'];
type MeDataIsSchema = Expect<Equal<MeData, components['schemas']['MeResponse']>>;
type MeOperationIsGetMe = Expect<Equal<paths['/api/v1/me']['get'], operations['getMe']>>;

declare const createCaseBody: components['schemas']['CreateCaseRequest'];
declare const idempotencyKey: string;

async function positiveContract(): Promise<void> {
  const result = await transport.request('/api/v1/me', 'get');
  if (result.kind === 'data') {
    acceptsMe(result.data);
    const status: 200 = result.status;
    void status;
  } else if (result.kind === 'http') {
    acceptsError(result.error);
    const status: 401 = result.status;
    void status;
  }

  const created = await transport.request('/api/v1/cases', 'post', {
    header: { 'Idempotency-Key': idempotencyKey },
    body: createCaseBody,
  });
  if (created.kind === 'data') {
    acceptsCase(created.data);
  }
}

async function negativeContract(): Promise<void> {
  // @ts-expect-error the path is absent from the frozen contract
  await transport.request('/api/v1/unknown', 'get');
  // @ts-expect-error /api/v1/me declares no post operation
  await transport.request('/api/v1/me', 'post');
  // @ts-expect-error getMe declares no query parameters
  await transport.request('/api/v1/me', 'get', { query: { unexpected: 'x' } });
  // @ts-expect-error GET /api/v1/me declares no request body
  await transport.request('/api/v1/me', 'get', { body: createCaseBody });
  const result = await transport.request('/api/v1/me', 'get');
  if (result.kind === 'data') {
    // @ts-expect-error MeResponse has no top-level displayName field
    acceptsString(result.data.displayName);
  }
}

void transport;
void positiveContract;
void negativeContract;
void (null as unknown as MeDataIsSchema);
void (null as unknown as MeOperationIsGetMe);