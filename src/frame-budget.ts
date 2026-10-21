/** A 60fps target, not a frame-rate cap. Resolution changes never change animation time. */
export class FrameBudget {
  readonly levels: number[];
  private index: number;
  private ceiling: number;
  private previous: number | undefined;
  private duration = 0;
  private count = 0;
  private longFrames = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  private cooldown = 500;
  private probing = false;

  constructor(deviceDpr: number, width: number, height: number) {
    const maximum = Math.max(0.5, Math.min(deviceDpr || 1, 1.5));
    this.levels = [...new Set([0.6, 0.65, 0.75, 0.85, 1, 1.25, maximum].filter(value => value <= maximum))].sort((a, b) => a - b);
    // Avoid starting a large Retina canvas with millions of unnecessary pixels.
    const initial = Math.min(maximum, Math.sqrt(1_500_000 / Math.max(1, width * height)));
    this.index = this.levels.reduce((selected, value, index) => value <= initial ? index : selected, 0);
    this.ceiling = this.levels.length - 1;
  }

  get dpr() { return this.levels[this.index]; }

  /** An idle demand frame or tab resume must not be counted as a slow frame. */
  resetSampling() {
    this.previous = undefined;
    this.duration = this.count = this.longFrames = this.slowWindows = this.fastWindows = 0;
    this.cooldown = 500;
  }

  frame(now: number): number | undefined {
    const delta = this.previous === undefined ? 0 : now - this.previous;
    this.previous = now;
    if (delta <= 0) return;
    if (delta > 250) { this.resetSampling(); this.previous = now; return; }
    if (this.cooldown > 0) { this.cooldown -= delta; return; }
    this.duration += delta;
    this.count++;
    if (delta > 25) this.longFrames++;
    if (this.duration < 1000 || this.count < 20) return;
    const average = this.duration / this.count;
    const slow = average > 1000 / 58.5 || this.longFrames / this.count > 0.15;
    const fast = average <= 1000 / 59.5 && this.longFrames / this.count < 0.05;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    this.fastWindows = fast ? this.fastWindows + 1 : 0;
    this.duration = this.count = this.longFrames = 0;
    if (this.slowWindows >= 2 && this.index > 0) {
      this.index--;
      // If a higher-resolution trial failed, don't keep oscillating between levels.
      if (this.probing) { this.ceiling = this.index; this.probing = false; }
    } else if (this.fastWindows >= 10 && this.index < this.ceiling) {
      this.index++;
      this.probing = true;
    } else return;
    this.slowWindows = this.fastWindows = 0;
    this.cooldown = 1500;
    return this.dpr;
  }
}
