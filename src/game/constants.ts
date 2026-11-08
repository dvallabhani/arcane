import type { Vec2 } from './math'

/*
 * Layout of the chamber. Everything the player interacts with lives on one
 * vertical plane (z = 0) that faces the camera. Mouse and hand input are both
 * projected onto that plane, so the game logic only ever deals with 2D points.
 */

/** Where the crystal floats when the scene starts or resets. */
export const CRYSTAL_START: Vec2 = { x: -2.4, y: 1.9 }

/** Horizontal position of the pedestal. */
export const PEDESTAL_X = 2.4

/** Height of the pedestal's top surface. */
export const PEDESTAL_TOP_Y = 1.18

/** Where the crystal comes to rest once it is placed on the pedestal. */
export const SOCKET: Vec2 = { x: PEDESTAL_X, y: 1.98 }

/** The crystal can't be dragged outside this box (keeps it on screen and above the floor). */
export const BOUNDS = { minX: -4.4, maxX: 4.4, minY: 0.75, maxY: 4.2 }

export const INTERACTION = {
  /** Cursor must come this close to the crystal to highlight it. */
  hoverEnter: 0.72,
  /** ...and must move this far away to un-highlight it (hysteresis, avoids flicker). */
  hoverExit: 0.98,
  /** Releasing the crystal within this distance of the socket counts as "placed". */
  snapRadius: 0.95,
  /** How quickly a grabbed crystal catches up with the cursor (higher = snappier). */
  followSpeed: 14,
  /** How quickly the crystal glides into the socket after a successful drop. */
  snapSpeed: 7,
}
