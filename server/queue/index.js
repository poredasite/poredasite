"use strict";
const { Queue } = require("bullmq");
const IORedis   = require("ioredis");

let _conn;

function getRedis() {
  if (!_conn) {
    _conn = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck:     false,
      lazyConnect:          true,
    });
    _conn.on("error", (e) => console.error("[Redis]", e.message));
  }
  return _conn;
}

const videoQueue = new Queue("video:processing", {
  connection: getRedis(),
  defaultJobOptions: {
    attempts:  3,
    backoff:   { type: "exponential", delay: 15_000 },
    removeOnComplete: { count: 200, age: 7 * 86400 },
    removeOnFail:     { count: 500 },
  },
});

module.exports = { videoQueue, getRedis };
