import type { Page } from "@playwright/test";

type Entries = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>;

export class BrowserCoverage {
  private active = false;
  constructor(private readonly page: Page, private readonly save: (entries: Entries) => Promise<void>) {}

  async start(): Promise<void> {
    await this.page.coverage.startJSCoverage();
    this.active = true;
  }

  async finish(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    await this.save(await this.page.coverage.stopJSCoverage());
  }

  async checkpoint(): Promise<void> {
    await this.finish();
    await this.start();
  }
}

export const pageCoverage = new WeakMap<Page, BrowserCoverage>();
