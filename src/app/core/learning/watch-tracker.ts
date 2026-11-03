/**
 * Counts seconds actually played, so seeking to the end does not count as watching.
 * Feed it the player's current time on every time update; jumps larger than MAX_STEP are ignored.
 */
export class WatchTracker {
  static readonly MAX_STEP_SECONDS = 2.5;

  private lastTime: number | null = null;
  private watchedSeconds: number;

  constructor(
    private durationSeconds: number,
    initialWatchedPercent = 0
  ) {
    this.watchedSeconds = (Math.max(0, initialWatchedPercent) / 100) * Math.max(0, durationSeconds);
  }

  get watchedPercent(): number {
    if (this.durationSeconds <= 0) return 0;
    return Math.min(100, Math.round((this.watchedSeconds / this.durationSeconds) * 100));
  }

  /**
   * The player's real duration always wins over the duration typed by the teacher; the share already
   * watched is kept when switching.
   */
  setDuration(durationSeconds: number): void {
    if (!(durationSeconds > 0) || durationSeconds === this.durationSeconds) return;

    const share = this.durationSeconds > 0 ? this.watchedSeconds / this.durationSeconds : 0;
    this.durationSeconds = durationSeconds;
    this.watchedSeconds = Math.min(1, share) * durationSeconds;
  }

  onTime(currentTime: number): void {
    if (this.lastTime !== null) {
      const step = currentTime - this.lastTime;
      if (step > 0 && step <= WatchTracker.MAX_STEP_SECONDS) {
        this.watchedSeconds = Math.min(this.durationSeconds, this.watchedSeconds + step);
      }
    }
    this.lastTime = currentTime;
  }
}
