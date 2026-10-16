// Work queues for the engine. A laptop GPU runs one model call at a time and LibreOffice one recalculation,
// so requests wait their turn instead of competing; a full queue answers 503 rather than piling up.
import process from 'node:process';

export class QueueFull extends Error {
  constructor(name) {
    super(`The engine is busy (${name} queue is full); try again shortly`);
    this.status = 503;
  }
}

export function queue(name, { concurrency = 1, limit = 20 } = {}) {
  let running = 0;
  const waiting = [];
  const stats = { done: 0, failed: 0, totalMs: 0 };
  const next = () => {
    while (running < concurrency && waiting.length) {
      const job = waiting.shift();
      running += 1;
      const started = Date.now();
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          running -= 1;
          stats.done += 1;
          stats.totalMs += Date.now() - started;
          next();
        });
    }
  };
  return {
    name,
    run(task) {
      if (waiting.length >= limit) return Promise.reject(new QueueFull(name));
      return new Promise((resolve, reject) => {
        waiting.push({ task, resolve, reject });
        next();
      });
    },
    status: () => ({
      running,
      waiting: waiting.length,
      done: stats.done,
      averageMs: stats.done ? Math.round(stats.totalMs / stats.done) : null
    })
  };
}

const number = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);

/** The engine's queues: model calls and workbook recalculation. */
export const queues = {
  model: queue('model', { concurrency: number(process.env.VULT_MODEL_CONCURRENCY, 1), limit: 50 }),
  recalc: queue('recalc', { concurrency: 1, limit: 20 })
};

/** One JSON line per request when VULT_ENGINE_LOG=json, for a log collector; otherwise silent. */
export function logRequest(entry) {
  if (process.env.VULT_ENGINE_LOG === 'json')
    process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}
