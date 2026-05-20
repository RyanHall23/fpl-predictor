'use strict';

/**
 * ETag + Cache-Control middleware utilities for JSON API responses.
 *
 * Applied selectively to GET routes that return stable-ish JSON blobs.
 * Clients that send If-None-Match get 304 Not Modified when content hasn't
 * changed.
 *
 * RFC 7232 §3.2: If-None-Match may contain a comma-separated list of ETags
 * or a wildcard "*".  We check each token after stripping optional W/ prefix
 * so both strong and weak ETags are matched correctly.
 */

const crypto = require('crypto');

/**
 * Returns true when the request's If-None-Match header matches the given ETag.
 * Handles wildcard "*" and weak ETags (W/"...") as per RFC 7232.
 *
 * @param {string|undefined} ifNoneMatch - Value of the request If-None-Match header.
 * @param {string} etag - Strong ETag to compare against (e.g. `"abc123"`).
 * @returns {boolean}
 */
const matchesEtag = (ifNoneMatch, etag) => {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === '*') return true;
  // Strip W/ prefix from the request tag(s), then compare to our strong tag.
  return ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);
};

/**
 * Express middleware factory that adds ETag + Cache-Control headers to JSON
 * responses.
 *
 * Caching is only applied to successful (2xx) responses.  Error responses
 * (4xx / 5xx) receive `Cache-Control: no-store` so that transient failures
 * are never served stale by a shared proxy or the browser.
 *
 * @param {number} maxAgeSec          - max-age value in seconds.
 * @param {number} [swr=0]            - stale-while-revalidate value in seconds
 *                                      (omitted from directive when 0).
 * @returns {import('express').RequestHandler}
 */
const withCacheHeaders = (maxAgeSec, swr = 0) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only apply public caching for successful responses (2xx status codes).
    const status = res.statusCode ?? 200;
    if (status >= 200 && status < 300) {
      // Serialize once — reuse the string both for the ETag hash and the
      // response body to avoid a second JSON.stringify call.
      const raw  = JSON.stringify(body);
      const etag = '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"';
      res.setHeader('ETag', etag);
      const directive = swr > 0
        ? `public, max-age=${maxAgeSec}, stale-while-revalidate=${swr}`
        : `public, max-age=${maxAgeSec}`;
      res.setHeader('Cache-Control', directive);
      if (matchesEtag(req.headers['if-none-match'], etag)) {
        return res.status(304).end();
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(raw);
    }
    // Error response — suppress public caching.
    res.setHeader('Cache-Control', 'no-store');
    return originalJson(body);
  };
  next();
};

module.exports = { matchesEtag, withCacheHeaders };
