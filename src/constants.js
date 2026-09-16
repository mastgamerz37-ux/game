// ---------------------------------------------------------------------------
// THE LAST PERIOD — shared constants. 1 unit = 1 metre.
// ---------------------------------------------------------------------------

export const FLOOR_H = 4.2; // vertical distance between levels
export const EYE_HEIGHT = 1.62;
export const CROUCH_HEIGHT = 1.05;
export const PLAYER_RADIUS = 0.34;
export const PLAYER_SPEED = 3.1;
export const PLAYER_SPRINT = 5.1;
export const GRAVITY = 24;

export const WT = 0.3; // wall thickness
export const WALL_H = 3.6; // interior wall height (a dark gap remains above)
export const DOOR_H = 2.35;
export const DOOR_W = 1.7;

export const CELL = 1.0; // flow-field / nav cell size

export const SAVE_KEY = 'last-period.save.v1';

export const COLORS = {
  wallOuter: 0x2a2f37,
  wallInner: 0x343a44,
  floor: 0x1c2026,
  floorTile: 0x242a32,
  ceiling: 0x13161a,
  door: 0x4a3524,
  desk: 0x5a4630,
  metal: 0x575f6a,
  chalk: 0xe8ecf2,
  bloodDark: 0x3a1010,
};
