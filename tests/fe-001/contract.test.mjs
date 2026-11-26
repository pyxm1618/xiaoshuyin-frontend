import { afterAll, describe, expect, test } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import createClient from 'openapi-fetch';

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

describe('frozen dependencies', () => {
  test('exact dependency versions and application test entry are declared', () => {
    const manifest = readJson(join(root, 'package.json'));
    expect(manifest.devDependencies.typescript).toBe('5.9.3');
    expect(manifest.devDependencies['openapi-fetch']).toBe('0.17.0');
    expect(manifest.devDependencies.vitest).toBe('3.2.7');
    expect(manifest.scripts['test:app']).toBe('vitest run tests/fe-001');
    expect(readJson(join(root, 'node_modules/typescript/package.json')).version).toBe('5.9.3');
    expect(readJson(join(root, 'node_modules/openapi-fetch/package.json')).version).toBe('0.17.0');
    expect(readJson(join(root, 'node_modules/vitest/package.json')).version).toBe('3.2.7');
  });
});

describe('typed client contract', () => {
  test('fixture compiles under the frozen strict tsconfig with full declaration checking', () => {
    expect(existsSync(fixture)).toBe(true);
    const diagnostics = diagnosticsFor([fixture], { skipLibCheck: false });
    expect(formatDiagnostics(diagnostics)).toBe('');
  });

  test('the root tsconfig keeps the frozen strict flags', () => {
    const options = compilerOptions();
    expect(options.strict).toBe(true);
    expect(options.exactOptionalPropertyTypes).toBe(true);
    expect(options.noUncheckedIndexedAccess).toBe(true);
    expect(options.noEmit).toBe(true);
    expect(options.types).toEqual([]);
    expect(options.lib).toEqual(['lib.es2020.d.ts', 'lib.dom.d.ts']);
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

describe('frozen client response semantics', () => {
  const me = {
    account: { id: '00000000-0000-4000-8000-000000000001', createdAt: '2026-01-01T00:00:00Z', status: 'ACTIVE' },
    person: { id: '00000000-0000-4000-8000-000000000002', createdAt: '2026-01-01T00:00:00Z' },
  };

  function clientReturning(status, body) {
    const calls = [];
    const client = createClient({
      baseUrl: 'https://api.test.invalid',
      fetch: async (request) => {
        calls.push(request);
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    return { client, calls };
  }

  test('200 resolves data and leaves error undefined', async () => {
    const { client, calls } = clientReturning(200, me);
    const result = await client.GET('/api/v1/me');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe('https://api.test.invalid/api/v1/me');
    expect(result.data).toEqual(me);
    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(200);
  });

  test('401 resolves error and leaves data undefined', async () => {
    const unauthenticated = { code: 'UNAUTHENTICATED', message: 'not signed in' };
    const { client } = clientReturning(401, unauthenticated);
    const result = await client.GET('/api/v1/me');
    expect(result.error).toEqual(unauthenticated);
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});
