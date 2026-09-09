"use strict";

const { ipFromReq } = require("../../utils/network");
const { apiError } = require("../../utils/errors");

function rateLimitFactory(rateBuckets) {
  return function rateLimit({ keyPrefix, windowMs, max }) {
    return (req, res, next) => {
      const ip = ipFromReq(req) || "unknown";
      const key = `${keyPrefix}:${ip}`;
      const now = Date.now();

      let bucket = rateBuckets.get(key);
      if (!bucket || now >= bucket.resetAt) {
        bucket = { count: 0, resetAt: now + windowMs };
        rateBuckets.set(key, bucket);
      }

      bucket.count += 1;

      const remaining = Math.max(0, max - bucket.count);
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

      if (bucket.count > max) {
        res.setHeader("Retry-After", String(retryAfterSec));
        return next(apiError(429, "RATE_LIMIT", "Zu viele Anfragen, bitte später erneut versuchen"));
      }

      next();
    };
  };
}

module.exports = { rateLimitFactory };