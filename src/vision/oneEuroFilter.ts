/**
 * One Euro Filter (Casiez, Roussel & Vogel, CHI 2012).
 *
 * Hand landmarks jitter by a few pixels even when your hand is still. A plain
 * moving average removes jitter but adds lag when you move quickly. The One
 * Euro filter adapts: when the signal is slow it smooths heavily (no jitter),
 * when it is fast it smooths lightly (no lag).
 *
 *  - minCutoff: smoothing at rest. Lower = smoother but laggier.
 *  - beta:      how much faster movement reduces smoothing.
 */
export class OneEuroFilter {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly derivativeCutoff: number
  private prevValue: number | null = null
  private prevDerivative = 0
  private prevTime = 0

  constructor(minCutoff = 1.5, beta = 1.5, derivativeCutoff = 1.0) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.derivativeCutoff = derivativeCutoff
  }

  reset(): void {
    this.prevValue = null
    this.prevDerivative = 0
  }

  /** @param value new raw sample  @param timeSeconds timestamp of the sample */
  filter(value: number, timeSeconds: number): number {
    if (this.prevValue === null) {
      this.prevValue = value
      this.prevTime = timeSeconds
      return value
    }
    const dt = Math.max(timeSeconds - this.prevTime, 1e-3)
    this.prevTime = timeSeconds

    // 1. Estimate (and smooth) how fast the value is changing.
    const derivative = (value - this.prevValue) / dt
    const aD = smoothingFactor(dt, this.derivativeCutoff)
    const smoothedDerivative = aD * derivative + (1 - aD) * this.prevDerivative

    // 2. Faster movement -> higher cutoff frequency -> less smoothing.
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative)
    const a = smoothingFactor(dt, cutoff)
    const smoothed = a * value + (1 - a) * this.prevValue

    this.prevValue = smoothed
    this.prevDerivative = smoothedDerivative
    return smoothed
  }
}

function smoothingFactor(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}
