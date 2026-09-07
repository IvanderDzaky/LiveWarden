export type RetryDecision = { retry: boolean; delayMs: number; error: string };

export const retryDecision = (error: unknown, status: number | null, attemptCount: number, maxAttempts: number): RetryDecision => {
  const message = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
  const retryableStatus = status !== null && (status === 408 || status === 425 || status === 429 || status >= 500);
  const retryableError = status === null;
  const retry = (retryableStatus || retryableError) && attemptCount < maxAttempts;
  const delays = [1_000, 5_000, 30_000];
  return { retry, delayMs: delays[Math.min(Math.max(attemptCount - 1, 0), delays.length - 1)], error: message };
};
