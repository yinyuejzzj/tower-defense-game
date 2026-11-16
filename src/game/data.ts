export const COLS = 16;
export const ROWS = 10;
export const CELL = 56;
export const WORLD_W = COLS * CELL;
export const WORLD_H = ROWS * CELL;

export const START_GOLD = 210;
export const START_LIVES = 18;
export const MAX_RANK = 3;
export const SELL_RATIO = 0.6;
export const SAVE_KEY = "jinji-fangxian-v1";
export const SELECT_KEY = "jinji-fangxian-selection-v1";

export type TowerKind = "bow" | "cannon" | "frost" | "ballista" | "hive" | "arc" | "venom";
export type EnemyKind =
  | "grunt"
  | "runner"
  | "armored"
  | "moth"
  | "boss"
  | "warden"
  | "shade"
  | "brood"
  | "spore";
export type TargetMode = "first" | "near" | "strong";
export type Phase = "menu" | "prep" | "combat" | "won" | "lost";

export type ChainSpec = { jumps: number; falloff: number; radius: number };
export type DotSpec = { dps: number; time: number; shred: number; shieldMelt: number };

export type TowerDef = {
  name: string;
  blurb: string;
  cost: number;
  range: number;
  damage: number;
  rate: number;
  splash: number;
  slow: number;
  slowTime: number;
  pierce: boolean;
  shotSpeed: number;
  /** Optional. When set, fire() uses a dedicated mechanism instead of a normal projectile. */
  mechanic?: "projectile" | "chain" | "corrode";
  chain?: ChainSpec;
  dot?: DotSpec;
  note?: string;
};

export const TOWERS: Record<TowerKind, TowerDef> = {
  bow: {
    name: "棘弓塔",
    blurb: "中程速射，专清小怪",
    cost: 60,
    range: 2.15,
    damage: 11,
    rate: 1.55,
    splash: 0,
    slow: 1,
    slowTime: 0,
    pierce: false,
    shotSpeed: 460,
  },
  hive: {
    name: "蜂巢塔",
    blurb: "贴着土路疯狂连射",
    cost: 75,
    range: 1.45,
    damage: 5,
    rate: 3.4,
    splash: 0,
    slow: 1,
    slowTime: 0,
    pierce: false,
    shotSpeed: 360,
  },
  frost: {
    name: "霜棱塔",
    blurb: "冰棱减速，拉长路程",
    cost: 100,
    range: 2.35,
    damage: 7,
    rate: 0.95,
    splash: 0,
    slow: 0.58,
    slowTime: 2,
    pierce: false,
    shotSpeed: 400,
  },
  cannon: {
    name: "焰炮塔",
    blurb: "慢炮，落地一片溅射",
    cost: 145,
    range: 1.95,
    damage: 26,
    rate: 0.46,
    splash: 0.92,
    slow: 1,
    slowTime: 0,
    pierce: false,
    shotSpeed: 270,
  },
  ballista: {
    name: "重弩塔",
    blurb: "超远射程，无视护甲",
    cost: 190,
    range: 3.25,
    damage: 40,
    rate: 0.36,
    splash: 0,
    slow: 1,
    slowTime: 0,
    pierce: true,
    shotSpeed: 720,
  },
  arc: {
    name: "引雷塔",
    blurb: "瞬发连锁，电击潜行与集群",
    cost: 170,
    range: 2.6,
    damage: 17,
    rate: 0.7,
    splash: 0,
    slow: 1,
    slowTime: 0,
    pierce: true,
    shotSpeed: 0,
    mechanic: "chain",
    chain: { jumps: 4, falloff: 0.78, radius: 1.6 },
    note: "无弹道瞬发；最多跳 4 个目标，每跳伤害 ×0.78，无视护甲，可命中潜行单位。",
  },
  venom: {
    name: "腐藤塔",
    blurb: "酸蚀破甲，持续溶解护盾",
    cost: 155,
    range: 2.25,
    damage: 9,
    rate: 0.62,
    splash: 0,
    slow: 1,
    slowTime: 0,
    pierce: false,
    shotSpeed: 300,
    mechanic: "corrode",
    dot: { dps: 8, time: 4.5, shred: 0.4, shieldMelt: 3 },
    note: "命中挂 4.5 秒酸蚀（8/秒）并削 40% 护甲；对护盾三倍溶解，潜行期间持续生效。",
  },
};

export const TOWER_ORDER: TowerKind[] = [
  "bow",
  "hive",
  "frost",
  "cannon",
  "ballista",
  "arc",
  "venom",
];

/** Tower kinds that ship a PNG sprite. Procedural kinds are drawn in render.ts. */
export const SPRITE_TOWERS: TowerKind[] = ["bow", "hive", "frost", "cannon", "ballista"];
/** Boss reuses the armored crab sprite; it has no file of its own. */
export const SPRITE_ENEMIES: EnemyKind[] = ["grunt", "runner", "armored", "moth"];

export type AuraSpec = { radius: number; shield: number; regen: number };
export type PhaseSpec = { visible: number; hidden: number };
export type SplitSpec = { kind: EnemyKind; count: number };

export type EnemyDef = {
  name: string;
  note: string;
  hp: number;
  speed: number;
  gold: number;
  armor: number;
  leak: number;
  scale: number;
  flying: boolean;
  /** Optional special behaviour. Absent on all five original enemies. */
  behavior?: "aura" | "phase" | "split";
  aura?: AuraSpec;
  phase?: PhaseSpec;
  split?: SplitSpec;
  counter?: string;
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    name: "棘甲虫",
    note: "普通",
    hp: 58,
    speed: 56,
    gold: 8,
    armor: 0,
    leak: 1,
    scale: 0.82,
    flying: false,
  },
  runner: {
    name: "疾行蜂",
    note: "极快",
    hp: 34,
    speed: 108,
    gold: 9,
    armor: 0,
    leak: 1,
    scale: 0.7,
    flying: false,
  },
  armored: {
    name: "重甲蟹",
    note: "护甲",
    hp: 200,
    speed: 36,
    gold: 18,
    armor: 0.62,
    leak: 1,
    scale: 0.94,
    flying: false,
  },
  moth: {
    name: "暮蛾",
    note: "飞行",
    hp: 42,
    speed: 84,
    gold: 10,
    armor: 0,
    leak: 1,
    scale: 0.76,
    flying: true,
  },
  boss: {
    name: "棘冠巨蟹",
    note: "首领",
    hp: 980,
    speed: 30,
    gold: 80,
    armor: 0.35,
    leak: 3,
    scale: 1.6,
    flying: false,
  },
  warden: {
    name: "棘卫",
    note: "护盾光环",
    hp: 260,
    speed: 30,
    gold: 30,
    armor: 0.25,
    leak: 2,
    scale: 1.05,
    flying: false,
    behavior: "aura",
    aura: { radius: 1.9, shield: 40, regen: 10 },
    counter: "为附近友军持续补护盾。腐藤塔酸蚀三倍溶解护盾，或先用重弩集火点掉棘卫本体。",
  },
  shade: {
    name: "影蛛",
    note: "周期潜行",
    hp: 96,
    speed: 92,
    gold: 22,
    armor: 0,
    leak: 1,
    scale: 0.86,
    flying: false,
    behavior: "phase",
    phase: { visible: 2.2, hidden: 1.0 },
    counter: "潜行时单体弹道无法锁定。引雷塔连锁、焰炮溅射仍可命中；酸蚀一旦挂上，潜行期间照样掉血。",
  },
  brood: {
    name: "孢母",
    note: "死亡分裂",
    hp: 190,
    speed: 46,
    gold: 26,
    armor: 0.1,
    leak: 2,
    scale: 1.02,
    flying: false,
    behavior: "split",
    split: { kind: "spore", count: 2 },
    counter: "被高伤单点秒杀会炸出两只高速孢子。把击杀点放在溅射或连锁覆盖范围内，连分裂体一起清掉。",
  },
  spore: {
    name: "孢子",
    note: "孢母分裂体 · 极快",
    hp: 24,
    speed: 132,
    gold: 4,
    armor: 0,
    leak: 1,
    scale: 0.55,
    flying: false,
    counter: "由孢母死亡时产生，本身不再分裂；用连锁或溅射成片清理。",
  },
};

/** `path` selects which spawn route a group uses (multi-spawn maps). */
export type WaveGroup = { kind: EnemyKind; count: number; interval: number; path?: number };

export const WAVES: WaveGroup[][] = [
  [{ kind: "grunt", count: 8, interval: 0.9 }],
  [
    { kind: "grunt", count: 8, interval: 0.7 },
    { kind: "runner", count: 5, interval: 0.55 },
  ],
  [
    { kind: "runner", count: 12, interval: 0.42 },
    { kind: "grunt", count: 6, interval: 0.55 },
  ],
  [
    { kind: "armored", count: 5, interval: 1.15 },
    { kind: "grunt", count: 8, interval: 0.5 },
  ],
  [
    { kind: "moth", count: 10, interval: 0.45 },
    { kind: "runner", count: 6, interval: 0.4 },
  ],
  [
    { kind: "armored", count: 6, interval: 0.9 },
    { kind: "moth", count: 8, interval: 0.42 },
  ],
  [
    { kind: "grunt", count: 12, interval: 0.36 },
    { kind: "runner", count: 10, interval: 0.32 },
    { kind: "armored", count: 4, interval: 0.85 },
  ],
  [
    { kind: "boss", count: 1, interval: 0.2 },
    { kind: "grunt", count: 10, interval: 0.45 },
  ],
  [
    { kind: "moth", count: 12, interval: 0.32 },
    { kind: "armored", count: 7, interval: 0.7 },
  ],
  [
    { kind: "runner", count: 16, interval: 0.28 },
    { kind: "armored", count: 6, interval: 0.62 },
    { kind: "moth", count: 8, interval: 0.34 },
  ],
  [
    { kind: "armored", count: 10, interval: 0.55 },
    { kind: "runner", count: 12, interval: 0.28 },
  ],
  [
    { kind: "boss", count: 1, interval: 0.2 },
    { kind: "grunt", count: 8, interval: 0.4 },
    { kind: "runner", count: 8, interval: 0.34 },
    { kind: "moth", count: 8, interval: 0.36 },
    { kind: "armored", count: 6, interval: 0.6 },
  ],
];

export const AIM_LABEL: Record<TargetMode, string> = {
  first: "最前",
  near: "最近",
  strong: "最强",
};

export function dmgMult(level: number) {
  return 1 + level * 0.4;
}

export function rateMult(level: number) {
  return 1 + level * 0.3;
}

export function upgradeCost(base: number, level: number, kind: "dmg" | "rate") {
  const steps = kind === "dmg" ? [0.55, 0.85, 1.25] : [0.45, 0.72, 1.05];
  return Math.round(base * steps[level]!);
}

export function waveBonus(index: number) {
  return 20 + index * 8;
}

export function cellCenter(c: number, r: number) {
  return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL };
}

export type Pt = { x: number; y: number };

function corner(c: number, r: number): Pt {
  return cellCenter(c, r);
}

export const WAYPOINTS: Pt[] = [
  { x: -CELL, y: corner(0, 5).y },
  corner(3, 5),
  corner(3, 2),
  corner(8, 2),
  corner(8, 7),
  corner(12, 7),
  corner(12, 4),
  { x: WORLD_W + CELL * 0.2, y: corner(15, 4).y },
];

export type Poly = { pts: Pt[]; segLen: number[]; total: number };

export function buildPoly(pts: Pt[]): Poly {
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
    segLen.push(len);
    total += len;
  }
  return { pts, segLen, total };
}

export const PATH = buildPoly(WAYPOINTS);

export function samplePath(dist: number, poly: Poly = PATH): { x: number; y: number; angle: number } {
  const d = Math.max(0, Math.min(poly.total, dist));
  let remain = d;
  for (let i = 0; i < poly.segLen.length; i++) {
    const len = poly.segLen[i]!;
    if (remain <= len || i === poly.segLen.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, remain / len);
      const a = poly.pts[i]!;
      const b = poly.pts[i + 1]!;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remain -= len;
  }
  const last = poly.pts[poly.pts.length - 1]!;
  return { x: last.x, y: last.y, angle: 0 };
}

function distPointToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

export function distToPath(x: number, y: number, poly: Poly = PATH) {
  let best = Infinity;
  for (let i = 0; i < poly.pts.length - 1; i++) {
    const a = poly.pts[i]!;
    const b = poly.pts[i + 1]!;
    best = Math.min(best, distPointToSeg(x, y, a.x, a.y, b.x, b.y));
  }
  return best;
}

export const BLOCK_DIST = CELL * 0.55;

/** A cell is buildable only when it clears every route on the current map. */
export function cellBuildable(
  c: number,
  r: number,
  polys: Poly[] = [PATH],
  cols = COLS,
  rows = ROWS,
) {
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
  const p = cellCenter(c, r);
  return polys.every((poly) => distToPath(p.x, p.y, poly) >= BLOCK_DIST);
}

export function waveRoster(index: number, waves: WaveGroup[][] = WAVES) {
  const groups = waves[index];
  const map = new Map<EnemyKind, number>();
  if (!groups) return map;
  for (const group of groups) {
    map.set(group.kind, (map.get(group.kind) ?? 0) + group.count);
  }
  return map;
}

export function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
