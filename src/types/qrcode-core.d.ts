declare module "qrcode/lib/core/alignment-pattern" {
  /** Centres [row, col] of the alignment patterns of a version (the ones overlapping finder patterns left out) */
  export function getPositions(version: number): [number, number][]
}
