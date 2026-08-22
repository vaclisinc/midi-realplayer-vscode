export class PlaybackCoordinator {
  currentTime = 0;
  pendingEngineTime = 0;
  engineSeekPending = false;
  playing = false;

  private rebuildCount = 0;

  get rebuilding(): boolean {
    return this.rebuildCount > 0;
  }

  updateFromEngine(time: number, duration: number): void {
    if (!this.playing || this.rebuilding) {
      return;
    }
    this.currentTime = clamp(time, 0, duration);
  }

  requestPlay(): void {
    this.playing = true;
  }

  requestPause(engineTime: number | undefined, duration: number): void {
    if (this.playing && !this.rebuilding && engineTime !== undefined) {
      this.currentTime = clamp(engineTime, 0, duration);
    }
    this.playing = false;
    this.pendingEngineTime = this.currentTime;
    this.engineSeekPending = this.rebuilding;
  }

  seek(time: number, engineTime: number, duration: number): void {
    this.currentTime = clamp(time, 0, duration);
    this.pendingEngineTime = clamp(engineTime, 0, duration);
  }

  beginRebuild(engineTime: number | undefined, duration: number): boolean {
    const firstRebuild = this.rebuildCount === 0;
    if (firstRebuild) {
      if (this.playing && engineTime !== undefined) {
        this.currentTime = clamp(engineTime, 0, duration);
      }
      this.pendingEngineTime = this.currentTime;
      this.engineSeekPending = true;
    }
    this.rebuildCount += 1;
    return firstRebuild;
  }

  completeRebuild(): boolean {
    this.rebuildCount = Math.max(0, this.rebuildCount - 1);
    this.pendingEngineTime = this.currentTime;
    this.engineSeekPending = true;
    return !this.rebuilding && this.playing;
  }

  markEngineResumed(): void {
    this.engineSeekPending = false;
  }

  finish(): void {
    this.playing = false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
