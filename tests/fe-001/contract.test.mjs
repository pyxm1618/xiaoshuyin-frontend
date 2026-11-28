import { afterAll, describe, expect, test } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createTransport } from '../../apps/miniprogram/transport/index';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const fixture = join(here, 'contract.types.ts');
const tempFiles = [];

afterAll(() => {
  for (const file of tempFiles) rmSync(file, { force: true });
});

function compilerOptions(overrides = {}) {
  const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  }
  return { ...parsed.options, ...overrides };
}

function diagnosticsFor(rootNames, overrides = {}) {
  const program = ts.createProgram({ rootNames, options: compilerOptions(overrides) });
  return ts.getPreEmitDiagnostics(program);
}

function formatDiagnostics(diagnostics) {
  return diagnostics
    .map((d) => `${d.file?.fileName ?? '<global>'}:${d.start ?? 0} TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
    .join('\n');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function platform(outcomes) {
  const calls = [];
  return {
    calls,
    request(options) {
      const call = { options, aborted: false };
      calls.push(call);
      const outcome = outcomes.shift();
      queueMicrotask(() => {
        if (!outcome) throw new Error('unexpected request');
        if (call.aborted) return;
        if (outcome.kind === 'success') {
          options.success({ statusCode: outcome.status, data: JSON.stringify(outcome.body), header: outcome.header ?? {} });
        } else {
          options.fail({ errMsg: outcome.errMsg });
        }
      });
      return {
        abort() {
          call.aborted = true;
        },
      };
    },
  };
}

const me = {
  account: { id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-01-01T00:00:00Z', status: 'ACTIVE' },
  person: { id: '00000000-0000-4000-8000-000000000002', createdAt: '2026-01-01T00:00:00Z' },
};

describe('frozen dependencies', () => {
  test('exact dependency versions and application test entry are declared without openapi-fetch', () => {
    const manifest = readJson(join(root, 'package.json'));
    expect(manifest.devDependencies.typescript).toBe('5.9.3');
    expect(manifest.devDependencies['miniprogram-api-typings']).toBe('5.3.1');
    expect(manifest.devDependencies.vitest).toBe('3.2.7');
    expect(manifest.devDependencies['openapi-fetch']).toBeUndefined();
    expect(manifest.scripts['test:app']).toBe('vitest run tests/fe-001');
    expect(readJson(join(root, 'node_modules/typescript/package.json')).version).toBe('5.9.3');
    expect(readJson(join(root, 'node_modules/miniprogram-api-typings/package.json')).version).toBe('5.3.1');
    expect(readJson(join(root, 'node_modules/vitest/package.json')).version).toBe('3.2.7');
    expect(existsSync(join(root, 'node_modules/openapi-fetch'))).toBe(false);
  });
});

describe('typed transport contract', () => {
  test('fixture compiles under the frozen strict tsconfig with full declaration checking', () => {
    expect(existsSync(fixture)).toBe(true);
    const diagnostics = diagnosticsFor([fixture], { skipLibCheck: false });
    expect(formatDiagnostics(diagnostics)).toBe('');
  });

  test('the root tsconfig keeps ES2020-only and the frozen strict flags', () => {
    const options = compilerOptions();
    expect(options.strict).toBe(true);
    expect(options.exactOptionalPropertyTypes).toBe(true);
    expect(options.noUncheckedIndexedAccess).toBe(true);
    expect(options.noEmit).toBe(true);
    expect(options.types).toEqual([]);
    expect(options.skipLibCheck).toBe(false);
    expect(options.lib).toEqual(['lib.es2020.d.ts']);
  });

  test('every @ts-expect-error directive is meaningful', () => {
    const source = readFileSync(fixture, 'utf8');
    const lines = source.split('\n');
    const directiveLines = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.trim().startsWith('// @ts-expect-error'));
    expect(directiveLines.length).toBe(5);
    const variants = directiveLines.map(({ index }) => {
      const file = join(here, `contract.negative-${index}.types.ts`);
      tempFiles.push(file);
      writeFileSync(file, lines.filter((_, i) => i !== index).join('\n'));
      return { file, line: index + 1 };
    });
    const diagnostics = diagnosticsFor(variants.map(({ file }) => file), { skipLibCheck: false });
    for (const { file, line } of variants) {
      const own = diagnostics.filter((diagnostic) => diagnostic.file?.fileName === file);
      expect(own.length, `directive at line ${line} must suppress a real error`).toBeGreaterThan(0);
    }
  }, 60_000);

  test('getMe is the only operation on /api/v1/me and maps 200/401 to MeResponse/Error', () => {
    const document = readJson(join(root, 'packages/generated/openapi.json'));
    const pathItem = document.paths['/api/v1/me'];
    const operations = Object.keys(pathItem).filter((key) => !['parameters', 'summary', 'description', 'servers'].includes(key));
    expect(operations).toEqual(['get']);
    expect(pathItem.parameters).toBeUndefined();
    const operation = pathItem.get;
    expect(operation.operationId).toBe('getMe');
    expect(operation.requestBody).toBeUndefined();
    expect(operation.parameters).toBeUndefined();
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.responses['200'].content['application/json'].schema.$ref).toBe('#/components/schemas/MeResponse');
    expect(operation.responses['401'].content['application/json'].schema.$ref).toBe('#/components/schemas/Error');
  });
});

describe('transport HTTP semantics', () => {
  test('200 resolves typed data, preserves status and sends bearer authorization', async () => {
    const fake = platform([{ kind: 'success', status: 200, body: me }]);
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    const result = await transport.request('/api/v1/me', 'get', { bearerToken: 'synthetic-token' });
    expect(result).toEqual({ kind: 'data', status: 200, data: me, error: undefined });
    expect(fake.calls).toHaveLength(1);
    const request = fake.calls[0].options;
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.test.invalid/api/v1/me');
    expect(request.responseType).toBe('text');
    expect(request.header.Authorization).toBe('Bearer synthetic-token');
  });

  test('401 resolves http error with the generated Error body', async () => {
    const unauthenticated = { code: 'UNAUTHENTICATED', message: 'not signed in' };
    const fake = platform([{ kind: 'success', status: 401, body: unauthenticated }]);
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    const result = await transport.request('/api/v1/me', 'get');
    expect(result).toEqual({ kind: 'http', status: 401, error: unauthenticated, data: undefined });
  });

  test('platform fail resolves as a network error, never as success', async () => {
    const fake = platform([{ kind: 'fail', errMsg: 'request:fail timeout' }]);
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    const result = await transport.request('/api/v1/me', 'get');
    expect(result).toEqual({ kind: 'network' });
  });

  test('2xx with an unparsable body is invalid, never success', async () => {
    const fake = platform([{ kind: 'success', status: 200, body: undefined }]);
    fake.request = (options) => {
      queueMicrotask(() => options.success({ statusCode: 200, data: 'not json', header: {} }));
      return { abort() {} };
    };
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    const result = await transport.request('/api/v1/me', 'get');
    expect(result).toEqual({ kind: 'invalid' });
  });

  test('a signal that aborts before dispatch settles cancelled and still aborts the task', async () => {
    const fake = platform([{ kind: 'success', status: 200, body: me }]);
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    let listener;
    const signal = {
      cancelled: false,
      subscribe(fn) {
        listener = fn;
        return () => {
          listener = undefined;
        };
      },
    };
    signal.cancelled = true;
    const pending = transport.request('/api/v1/me', 'get', { signal });
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
    expect(fake.calls[0].aborted).toBe(true);
    if (listener) listener(true);
  });

  test('only one terminal result is delivered even if the platform calls success then fail', async () => {
    const calls = [];
    const fake = {
      request(options) {
        calls.push(options);
        queueMicrotask(() => {
          options.success({ statusCode: 200, data: JSON.stringify(me), header: {} });
          options.fail({ errMsg: 'late failure' });
        });
        return { abort() {} };
      },
    };
    const transport = createTransport({ baseUrl: 'https://api.test.invalid', platform: fake });
    const result = await transport.request('/api/v1/me', 'get');
    expect(result.kind).toBe('data');
    expect(calls).toHaveLength(1);
  });
});