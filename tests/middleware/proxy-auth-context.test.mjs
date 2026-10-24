import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/lib/auth/proxyAuthContext.js', import.meta.url), 'utf8');
const { getProxyAuthContext } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const request = () => ({
  url: 'https://example.test/v1/chat/completions?key=query-key',
  nextUrl: new URL('https://example.test/v1/chat/completions?key=query-key'),
  headers: new Headers({
    authorization: 'Bearer test-key', cookie: 'auth_token=test-session',
    'x-middleware-subrequest': 'forged', 'x-fr-real-ip': '127.0.0.1',
    'x-fr-query-api-key': 'forged',
  }),
});

test('forwards credentials to a fixed same-origin Node route once per request', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ tokenAuthenticated: true, settings: { requireLogin: true } });
  };
  try {
    const req = request();
    const [a, b] = await Promise.all([getProxyAuthContext(req), getProxyAuthContext(req)]);
    assert.equal(a.tokenAuthenticated, true);
    assert.deepEqual(a, b);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.href, 'https://example.test/api/auth/proxy-check');
    const opts = calls[0].options;
    assert.equal(opts.method, 'POST');
    assert.equal(opts.cache, 'no-store');
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.headers.get('authorization'), 'Bearer test-key');
    assert.equal(opts.headers.get('x-fr-query-api-key'), 'query-key');
    assert.equal(opts.headers.has('x-middleware-subrequest'), false);
    assert.equal(opts.headers.has('x-fr-real-ip'), false);
    assert.equal(opts.body, undefined);
  } finally { globalThis.fetch = original; }
});

test('fails closed on backend errors, redirects, and malformed JSON', async () => {
  const original = globalThis.fetch;
  try {
    for (const handler of [
      async () => { throw new Error('offline'); },
      async () => new Response('', { status: 503 }),
      async () => new Response('invalid-json'),
    ]) {
      globalThis.fetch = handler;
      const result = await getProxyAuthContext(request());
      assert.equal(result.tokenAuthenticated, false);
      assert.equal(result.cliAuthenticated, false);
      assert.equal(result.apiKeyAuthenticated, false);
      assert.equal(result.settings, null);
    }
  } finally { globalThis.fetch = original; }
});
