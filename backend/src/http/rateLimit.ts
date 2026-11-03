type Bucket = {
  resetAt: number;
  count: number;
};

export function createRateLimiter(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return function allow(key: string, now = Date.now()): boolean {
    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      buckets.set(key, { resetAt: now + windowMs, count: 1 });
      return true;
    }
    if (current.count >= max) {
      return false;
    }
    current.count += 1;
    return true;
  };
}
