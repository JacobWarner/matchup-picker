// One page at a time — Render free tier has 512MB RAM, Chromium is heavy
const MAX_CONCURRENT = 1;
const DELAY_MS = 300;

let active = 0;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else {
      queue.push(resolve);
    }
  });
}

function release(): void {
  setTimeout(() => {
    if (queue.length > 0) {
      const next = queue.shift()!;
      next();
    } else {
      active--;
    }
  }, DELAY_MS);
}

export async function withThrottle<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}
