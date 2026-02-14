export class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export interface FetchRetryOptions {
  url: string | URL;
  buildInit: () => RequestInit;
  operationName: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  retryOnStatusCodes?: number[];
}

const DEFAULT_RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryStatus(status: number, retryOnStatusCodes: Set<number>): boolean {
  return retryOnStatusCodes.has(status);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TypeError" ||
    /network|fetch failed|socket|econnreset|econnrefused|etimedout|timed out/i.test(error.message)
  );
}

function isRetriableError(error: unknown): boolean {
  return error instanceof RequestTimeoutError || isAbortError(error) || isNetworkError(error);
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

function computeDelayMs(params: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  retryAfterMs: number | null;
}): number {
  if (params.retryAfterMs !== null) {
    return Math.min(params.retryAfterMs, params.maxDelayMs);
  }

  const exponential = Math.min(
    params.maxDelayMs,
    Math.round(params.baseDelayMs * Math.pow(2, Math.max(0, params.attempt - 1)))
  );

  if (params.jitterRatio <= 0) {
    return exponential;
  }

  const jitterRange = Math.round(exponential * params.jitterRatio);
  const jitter = Math.floor(Math.random() * (jitterRange + 1));
  return Math.min(params.maxDelayMs, exponential + jitter);
}

function mergeSignals(parent: AbortSignal | null | undefined, timeoutController?: AbortController): AbortSignal | undefined {
  if (!parent) {
    return timeoutController?.signal;
  }

  if (!timeoutController) {
    return parent;
  }

  if (parent.aborted) {
    timeoutController.abort(parent.reason);
    return timeoutController.signal;
  }

  const onAbort = () => timeoutController.abort(parent.reason);
  parent.addEventListener("abort", onAbort, { once: true });

  timeoutController.signal.addEventListener(
    "abort",
    () => parent.removeEventListener("abort", onAbort),
    { once: true }
  );

  return timeoutController.signal;
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string | URL,
  init: RequestInit,
  timeoutMs: number,
  operationName: string
): Promise<Response> {
  const timeoutController = new AbortController();
  const signal = mergeSignals(init.signal, timeoutController);

  const timer = setTimeout(() => {
    timeoutController.abort(`timeout:${operationName}`);
  }, timeoutMs);

  try {
    return await fetchFn(url, {
      ...init,
      signal
    });
  } catch (error: unknown) {
    if (isAbortError(error) && timeoutController.signal.aborted) {
      throw new RequestTimeoutError(`${operationName} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWithRetry(options: FetchRetryOptions): Promise<Response> {
  const {
    url,
    buildInit,
    operationName,
    fetchFn = fetch,
    timeoutMs = 20_000,
    maxAttempts = 3,
    baseDelayMs = 600,
    maxDelayMs = 8_000,
    jitterRatio = 0.25,
    retryOnStatusCodes = DEFAULT_RETRYABLE_STATUS_CODES
  } = options;

  const retryStatusCodes = new Set<number>(retryOnStatusCodes);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchFn, url, buildInit(), timeoutMs, operationName);

      if (!response.ok && shouldRetryStatus(response.status, retryStatusCodes) && attempt < maxAttempts) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const delayMs = computeDelayMs({
          attempt,
          baseDelayMs,
          maxDelayMs,
          jitterRatio,
          retryAfterMs
        });
        await response.text().catch(() => undefined);
        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (error: unknown) {
      lastError = error;
      if (!isRetriableError(error) || attempt >= maxAttempts) {
        break;
      }

      const delayMs = computeDelayMs({
        attempt,
        baseDelayMs,
        maxDelayMs,
        jitterRatio,
        retryAfterMs: null
      });
      await sleep(delayMs);
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`${operationName} failed after ${maxAttempts} attempts: ${lastError.message}`);
  }

  throw new Error(`${operationName} failed after ${maxAttempts} attempts`);
}
