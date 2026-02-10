export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  openStateMs: number;
  halfOpenSuccessesToClose: number;
}

const defaultOptions: CircuitBreakerOptions = {
  failureThreshold: 5,
  failureWindowMs: 60_000,
  openStateMs: 120_000,
  halfOpenSuccessesToClose: 3
};

interface CircuitSnapshot {
  state: CircuitState;
  openedAtMs: number | null;
  failures: number[];
  halfOpenSuccesses: number;
}

export class InMemoryCircuitBreaker {
  private state: CircuitState = "closed";
  private openedAtMs: number | null = null;
  private failures: number[] = [];
  private halfOpenSuccesses = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      ...defaultOptions,
      ...options
    };
  }

  private pruneFailures(now: number): void {
    const cutoff = now - this.options.failureWindowMs;
    this.failures = this.failures.filter((time) => time >= cutoff);
  }

  canExecute(now = Date.now()): boolean {
    if (this.state === "open") {
      if (this.openedAtMs !== null && now - this.openedAtMs >= this.options.openStateMs) {
        this.state = "half_open";
        this.halfOpenSuccesses = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(): void {
    if (this.state === "half_open") {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.options.halfOpenSuccessesToClose) {
        this.state = "closed";
        this.failures = [];
        this.openedAtMs = null;
        this.halfOpenSuccesses = 0;
      }
      return;
    }

    if (this.state === "closed") {
      this.failures = [];
    }
  }

  onFailure(now = Date.now()): void {
    if (this.state === "half_open") {
      this.state = "open";
      this.openedAtMs = now;
      this.halfOpenSuccesses = 0;
      return;
    }

    this.pruneFailures(now);
    this.failures.push(now);
    if (this.failures.length >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAtMs = now;
    }
  }

  getSnapshot(): CircuitSnapshot {
    return {
      state: this.state,
      openedAtMs: this.openedAtMs,
      failures: [...this.failures],
      halfOpenSuccesses: this.halfOpenSuccesses
    };
  }
}
