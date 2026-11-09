import { config } from "../config.js";
import { logger } from "../logger.js";

/** Counts real upstream requests per UTC day; warns once at 80% of the daily limit. */
export class UsageCounter {
  private day = "";
  private count = 0;
  private warned = false;

  constructor(
    readonly limit: number,
    private readonly now: () => Date = () => new Date(),
    private readonly warn: (msg: string, meta: object) => void = (msg, meta) =>
      logger.warn(meta, msg),
  ) {}

  private rollover(): void {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
      this.warned = false;
    }
  }

  increment(): number {
    this.rollover();
    this.count++;
    if (!this.warned && this.count >= this.limit * 0.8) {
      this.warned = true;
      this.warn("Open-Meteo daily request usage reached 80% of DAILY_UPSTREAM_LIMIT", {
        count: this.count,
        limit: this.limit,
      });
    }
    return this.count;
  }

  /** Requests made so far today (UTC). */
  get today(): number {
    this.rollover();
    return this.count;
  }

  get exhausted(): boolean {
    return this.today >= this.limit;
  }

  reset(): void {
    this.day = "";
    this.count = 0;
    this.warned = false;
  }
}

export const usage = new UsageCounter(config.DAILY_UPSTREAM_LIMIT);
