import createClient from 'openapi-fetch';
import type { components, paths } from '../../packages/generated/openapi';

const client = createClient<paths>({ baseUrl: 'https://api.test.invalid' });

function acceptsMe(value: components['schemas']['MeResponse']): void {
  void value;
}

function acceptsError(value: components['schemas']['Error']): void {
  void value;
}

async function positiveContract(): Promise<void> {
  const { data, error, response } = await client.GET('/api/v1/me');
  if (data !== undefined) acceptsMe(data);
  if (error !== undefined) acceptsError(error);
  const httpStatus: number = response.status;
  void httpStatus;
}

type Expect<T extends true> = T;
type Equal<Left, Right> = (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
  ? true
  : false;
type MeData = paths['/api/v1/me']['get']['responses'][200]['content']['application/json'];
type MeDataIsSchema = Expect<Equal<MeData, components['schemas']['MeResponse']>>;

async function negativeContract(): Promise<void> {
  // @ts-expect-error the path is absent from the frozen contract
  await client.GET('/api/v1/unknown');
  // @ts-expect-error /api/v1/me declares no POST operation
  await client.POST('/api/v1/me');
  // @ts-expect-error GET /api/v1/me declares no request body
  await client.GET('/api/v1/me', { body: { any: 'thing' } });
  // @ts-expect-error getMe declares no query parameters
  await client.GET('/api/v1/me', { params: { query: { unexpected: 'x' } } });
  // @ts-expect-error MeResponse has no top-level displayName field
  acceptString(await client.GET('/api/v1/me').then(({ data }) => data?.displayName));
}

function acceptString(value: string | undefined): void {
  void value;
}

void client;
void positiveContract;
void negativeContract;
void (null as unknown as MeDataIsSchema);
