'use strict';

/**
 * Tests for backend/utils/cacheHeaders.js
 *
 * Verifies that:
 *  - matchesEtag correctly handles absent, wildcard, strong, weak, and
 *    multi-value If-None-Match headers.
 *  - withCacheHeaders middleware sets ETag + Cache-Control headers on
 *    successful (2xx) responses and Cache-Control: no-store on errors.
 *
 * Runs with Node.js built-in test runner: node --test
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { matchesEtag, withCacheHeaders } = require('../utils/cacheHeaders');

// ---------------------------------------------------------------------------
// Helpers — minimal Express req/res fakes
// ---------------------------------------------------------------------------

const makeReq = (headers = {}) => ({ headers });

/**
 * Build a minimal res fake.
 * @param {number} statusCode - HTTP status code to simulate.
 */
const makeRes = (statusCode = 200) => {
  const headers = {};
  let endedWith = null;
  let statusAfterCall = null;
  let jsonCalledWith = null;

  const res = {
    statusCode,
    headers,
    _endedWith: () => endedWith,
    _statusAfterCall: () => statusAfterCall,
    _jsonCalledWith: () => jsonCalledWith,
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    end(data) { endedWith = data ?? null; return this; },
    status(code) { statusAfterCall = code; return this; },
    // Bind a real json implementation that tests can override
    json(body) { jsonCalledWith = body; return this; },
  };
  // withCacheHeaders calls res.json.bind(res) at setup time, so json must be
  // defined before the middleware wraps it.
  res.json = res.json.bind(res);
  return res;
};

// ---------------------------------------------------------------------------
// matchesEtag
// ---------------------------------------------------------------------------

describe('matchesEtag', () => {
  test('returns false when ifNoneMatch is undefined', () => {
    assert.equal(matchesEtag(undefined, '"abc"'), false);
  });

  test('returns false when ifNoneMatch is empty string', () => {
    assert.equal(matchesEtag('', '"abc"'), false);
  });

  test('returns true for wildcard "*"', () => {
    assert.equal(matchesEtag('*', '"abc"'), true);
  });

  test('returns true for exact strong ETag match', () => {
    assert.equal(matchesEtag('"abc123"', '"abc123"'), true);
  });

  test('returns false for non-matching ETag', () => {
    assert.equal(matchesEtag('"abc123"', '"xyz789"'), false);
  });

  test('matches a weak ETag W/"abc123" against strong ETag "abc123"', () => {
    assert.equal(matchesEtag('W/"abc123"', '"abc123"'), true);
  });

  test('matches one of several comma-separated ETags', () => {
    assert.equal(matchesEtag('"old1", "abc123", "old2"', '"abc123"'), true);
  });

  test('returns false when none of the comma-separated ETags match', () => {
    assert.equal(matchesEtag('"old1", "old2"', '"abc123"'), false);
  });

  test('handles whitespace around comma-separated entries', () => {
    assert.equal(matchesEtag('  "old1"  ,  "abc123"  ', '"abc123"'), true);
  });
});

// ---------------------------------------------------------------------------
// withCacheHeaders — middleware
// ---------------------------------------------------------------------------

describe('withCacheHeaders — successful (2xx) responses', () => {
  test('sets Cache-Control with max-age only when swr is 0', () => {
    const middleware = withCacheHeaders(300);
    const req = makeReq();
    const res = makeRes(200);
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled, 'next() must be called');

    res.json({ hello: 'world' });

    assert.match(res.headers['Cache-Control'], /^public, max-age=300$/);
    assert.ok(!res.headers['Cache-Control'].includes('stale-while-revalidate'));
  });

  test('includes stale-while-revalidate when swr > 0', () => {
    const middleware = withCacheHeaders(60, 30);
    const req = makeReq();
    const res = makeRes(200);
    middleware(req, res, () => {});

    res.json({ data: 1 });

    assert.equal(res.headers['Cache-Control'], 'public, max-age=60, stale-while-revalidate=30');
  });

  test('sets an ETag header', () => {
    const middleware = withCacheHeaders(60, 30);
    const req = makeReq();
    const res = makeRes(200);
    middleware(req, res, () => {});

    res.json({ value: 42 });

    const etag = res.headers['ETag'];
    assert.ok(etag, 'ETag header must be set');
    assert.match(etag, /^"[0-9a-f]+"$/, 'ETag must be a quoted hex string');
  });

  test('same body produces the same ETag (deterministic)', () => {
    const body = { players: [1, 2, 3] };
    const mw = withCacheHeaders(300, 60);

    const req1 = makeReq();
    const res1 = makeRes(200);
    mw(req1, res1, () => {});
    res1.json(body);

    const req2 = makeReq();
    const res2 = makeRes(200);
    mw(req2, res2, () => {});
    res2.json(body);

    assert.equal(res1.headers['ETag'], res2.headers['ETag']);
  });

  test('different bodies produce different ETags', () => {
    const mw = withCacheHeaders(300, 60);

    const req1 = makeReq();
    const res1 = makeRes(200);
    mw(req1, res1, () => {});
    res1.json({ a: 1 });

    const req2 = makeReq();
    const res2 = makeRes(200);
    mw(req2, res2, () => {});
    res2.json({ a: 2 });

    assert.notEqual(res1.headers['ETag'], res2.headers['ETag']);
  });

  test('returns 304 when If-None-Match matches computed ETag', () => {
    // First request — learn the ETag
    const mw = withCacheHeaders(300, 60);
    const body = { value: 'cached' };

    const req1 = makeReq();
    const res1 = makeRes(200);
    mw(req1, res1, () => {});
    res1.json(body);
    const etag = res1.headers['ETag'];

    // Second request — send the ETag back
    const req2 = makeReq({ 'if-none-match': etag });
    const res2 = makeRes(200);
    mw(req2, res2, () => {});
    res2.json(body);

    assert.equal(res2._statusAfterCall(), 304);
  });

  test('sets Content-Type: application/json', () => {
    const mw = withCacheHeaders(300);
    const req = makeReq();
    const res = makeRes(200);
    mw(req, res, () => {});
    res.json({ x: 1 });

    assert.equal(res.headers['Content-Type'], 'application/json');
  });
});

describe('withCacheHeaders — error (4xx/5xx) responses', () => {
  const errorCodes = [400, 401, 403, 404, 500, 502, 503];

  for (const code of errorCodes) {
    test(`sets Cache-Control: no-store for status ${code}`, () => {
      const mw = withCacheHeaders(300, 60);
      const req = makeReq();
      const res = makeRes(code);
      mw(req, res, () => {});
      res.json({ error: 'something went wrong' });

      assert.equal(res.headers['Cache-Control'], 'no-store',
        `status ${code} must set Cache-Control: no-store`);
    });

    test(`does not set ETag for status ${code}`, () => {
      const mw = withCacheHeaders(300, 60);
      const req = makeReq();
      const res = makeRes(code);
      mw(req, res, () => {});
      res.json({ error: 'something went wrong' });

      assert.equal(res.headers['ETag'], undefined,
        `status ${code} must not set an ETag header`);
    });
  }
});
