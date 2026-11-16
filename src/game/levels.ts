import {
  CELL,
  PATH,
  WAVES,
  WORLD_W,
  buildPoly,
  type EnemyKind,
  type Poly,
  type Pt,
  type WaveGroup,
} from "./data";

export type Difficulty = "normal" | "hard";

export type Level = {
  id: string;
  name: string;
  blurb: string;
  cols: number;
  rows: number;
  paths: Poly[];
  waves: WaveGroup[][];
  /** Per-wave HP growth. Legacy maps keep 0.14 untouched; long maps use a gentler curve. */
  hpCurve: number;
};

/**
 * Difficulty only applies small runtime multipliers. The base ENEMIES table is
 * never touched, and "normal" is a literal no-op (all multipliers = 1).
 */
export const DIFFICULTY: Record<
  Difficulty,
  { label: string; hpScale: number; intervalScale: number; note: string }
> = {
  normal: { label: "普通", hpScale: 1, intervalScale: 1, note: "沿用原版全部数值" },
  hard: { label: "困难", hpScale: 1.12, intervalScale: 0.92, note: "敌人生命 +12%，出怪间隔 -8%" },
};

const corner = (c: number, r: number): Pt => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL });
const left = (r: number): Pt => ({ x: -CELL, y: (r + 0.5) * CELL });
const top = (c: number): Pt => ({ x: (c + 0.5) * CELL, y: -CELL });
const bottom = (rows: number, c: number): Pt => ({ x: (c + 0.5) * CELL, y: rows * CELL + CELL });
const exit = (cols: number, r: number): Pt => ({ x: cols * CELL + CELL * 0.2, y: (r + 0.5) * CELL });

export const ALL_ENEMY_KINDS: EnemyKind[] = [
  "grunt",
  "runner",
  "armored",
  "moth",
  "boss",
  "warden",
  "shade",
  "brood",
  "spore",
];

/** Every level's final wave must contain every enemy type in the game. */
export function finalWaveKinds(level: Level) {
  const last = level.waves[level.waves.length - 1] ?? [];
  return new Set(last.map((group) => group.kind));
}

/**
 * Legacy maps keep every wave untouched except a small final-wave addendum, so
 * the new unit types appear there too without changing their established feel.
 */
function extendLegacyFinal(waves: WaveGroup[][], paths: number): WaveGroup[][] {
  const out = waves.map((wave) => wave.map((group) => ({ ...group })));
  const last = out[out.length - 1]!;
  const present = new Set(last.map((group) => group.kind));
  const extras: { kind: EnemyKind; count: number; interval: number }[] = [
    { kind: "warden", count: 1, interval: 1.1 },
    { kind: "shade", count: 2, interval: 0.8 },
    { kind: "brood", count: 1, interval: 1.0 },
    { kind: "spore", count: 3, interval: 0.42 },
  ];
  let slot = 0;
  for (const extra of extras) {
    if (present.has(extra.kind)) continue;
    last.push({
      ...extra,
      path: paths > 1 ? slot % paths : undefined,
    });
    slot += 1;
  }
  return out;
}

// ── 关卡 1：金棘古道（原版地图 / 原版路径 / 12 波）────────────────────────
const classicWaves: WaveGroup[][] = extendLegacyFinal(WAVES, 1);

// ── 关卡 2：折棘回廊（同尺寸 16×10，全新折返路径，12 波）──────────────────
const foldWaypoints: Pt[] = [
  { x: corner(7, 0).x, y: -CELL },
  corner(7, 3),
  corner(2, 3),
  corner(2, 8),
  corner(9, 8),
  corner(9, 5),
  corner(13, 5),
  { x: WORLD_W + CELL * 0.2, y: corner(15, 5).y },
];

const foldWaves: WaveGroup[][] = extendLegacyFinal(
  [
    [{ kind: "runner", count: 7, interval: 0.62 }],
    [
      { kind: "moth", count: 6, interval: 0.55 },
      { kind: "grunt", count: 5, interval: 0.7 },
    ],
    [
      { kind: "armored", count: 4, interval: 1.0 },
      { kind: "runner", count: 8, interval: 0.4 },
    ],
    [
      { kind: "moth", count: 10, interval: 0.34 },
      { kind: "grunt", count: 6, interval: 0.55 },
    ],
    [
      { kind: "runner", count: 14, interval: 0.26 },
      { kind: "armored", count: 3, interval: 0.9 },
    ],
    [
      { kind: "grunt", count: 10, interval: 0.4 },
      { kind: "moth", count: 8, interval: 0.36 },
      { kind: "runner", count: 6, interval: 0.3 },
    ],
    [
      { kind: "armored", count: 7, interval: 0.7 },
      { kind: "moth", count: 9, interval: 0.32 },
    ],
    [
      { kind: "boss", count: 1, interval: 0.2 },
      { kind: "runner", count: 10, interval: 0.3 },
    ],
    [
      { kind: "grunt", count: 14, interval: 0.3 },
      { kind: "armored", count: 6, interval: 0.62 },
    ],
    [
      { kind: "moth", count: 14, interval: 0.28 },
      { kind: "runner", count: 12, interval: 0.26 },
    ],
    [
      { kind: "armored", count: 9, interval: 0.5 },
      { kind: "moth", count: 10, interval: 0.3 },
      { kind: "grunt", count: 8, interval: 0.42 },
    ],
    [
      { kind: "boss", count: 1, interval: 0.2 },
      { kind: "grunt", count: 8, interval: 0.4 },
      { kind: "runner", count: 10, interval: 0.3 },
      { kind: "armored", count: 6, interval: 0.6 },
      { kind: "moth", count: 8, interval: 0.34 },
    ],
  ],
  1,
);

// ── 关卡 3：双门长径（22×14 大地图，两条独立路径，16 波）───────────────────
const twinCols = 22;
const twinRows = 14;
const twinW = twinCols * CELL;
const gateY = corner(21, 7).y;

const upperWaypoints: Pt[] = [
  { x: -CELL, y: corner(0, 3).y },
  corner(3, 3),
  corner(3, 1),
  corner(9, 1),
  corner(9, 5),
  corner(15, 5),
  corner(15, 7),
  corner(19, 7),
  { x: twinW + CELL * 0.2, y: gateY },
];

const lowerWaypoints: Pt[] = [
  { x: -CELL, y: corner(0, 11).y },
  corner(4, 11),
  corner(4, 9),
  corner(10, 9),
  corner(10, 12),
  corner(14, 12),
  corner(14, 7),
  corner(19, 7),
  { x: twinW + CELL * 0.2, y: gateY },
];

const twinWaves: WaveGroup[][] = extendLegacyFinal(
  [
    [
      { kind: "grunt", count: 6, interval: 0.8, path: 0 },
      { kind: "grunt", count: 5, interval: 0.8, path: 1 },
    ],
    [
      { kind: "runner", count: 6, interval: 0.5, path: 1 },
      { kind: "grunt", count: 6, interval: 0.7, path: 0 },
    ],
    [
      { kind: "moth", count: 6, interval: 0.48, path: 0 },
      { kind: "runner", count: 6, interval: 0.5, path: 1 },
    ],
    [
      { kind: "armored", count: 4, interval: 1.0, path: 0 },
      { kind: "grunt", count: 8, interval: 0.45, path: 1 },
    ],
    [
      { kind: "runner", count: 10, interval: 0.28, path: 0 },
      { kind: "moth", count: 6, interval: 0.44, path: 1 },
    ],
    [
      { kind: "grunt", count: 10, interval: 0.4, path: 1 },
      { kind: "armored", count: 5, interval: 0.85, path: 0 },
    ],
    [
      { kind: "moth", count: 8, interval: 0.34, path: 0 },
      { kind: "runner", count: 8, interval: 0.32, path: 1 },
      { kind: "armored", count: 3, interval: 0.9, path: 0 },
    ],
    [
      { kind: "boss", count: 1, interval: 0.2, path: 0 },
      { kind: "grunt", count: 8, interval: 0.42, path: 1 },
      { kind: "runner", count: 6, interval: 0.32, path: 0 },
    ],
    [
      { kind: "armored", count: 7, interval: 0.66, path: 1 },
      { kind: "moth", count: 8, interval: 0.34, path: 0 },
    ],
    [
      { kind: "runner", count: 12, interval: 0.26, path: 0 },
      { kind: "grunt", count: 10, interval: 0.38, path: 1 },
      { kind: "moth", count: 6, interval: 0.36, path: 1 },
    ],
    [
      { kind: "armored", count: 6, interval: 0.6, path: 0 },
      { kind: "armored", count: 6, interval: 0.6, path: 1 },
      { kind: "runner", count: 8, interval: 0.3, path: 0 },
    ],
    [
      { kind: "moth", count: 10, interval: 0.3, path: 1 },
      { kind: "grunt", count: 10, interval: 0.36, path: 0 },
      { kind: "runner", count: 8, interval: 0.3, path: 1 },
    ],
    [
      { kind: "boss", count: 1, interval: 0.2, path: 1 },
      { kind: "armored", count: 5, interval: 0.7, path: 0 },
      { kind: "moth", count: 8, interval: 0.32, path: 1 },
    ],
    [
      { kind: "runner", count: 14, interval: 0.24, path: 0 },
      { kind: "armored", count: 7, interval: 0.6, path: 1 },
      { kind: "grunt", count: 8, interval: 0.4, path: 0 },
    ],
    [
      { kind: "moth", count: 12, interval: 0.28, path: 0 },
      { kind: "armored", count: 8, interval: 0.55, path: 1 },
      { kind: "runner", count: 10, interval: 0.28, path: 0 },
      { kind: "grunt", count: 8, interval: 0.4, path: 1 },
    ],
    [
      { kind: "boss", count: 1, interval: 0.2, path: 0 },
      { kind: "boss", count: 1, interval: 0.2, path: 1 },
      { kind: "grunt", count: 8, interval: 0.4, path: 0 },
      { kind: "runner", count: 10, interval: 0.3, path: 1 },
      { kind: "armored", count: 6, interval: 0.6, path: 0 },
      { kind: "moth", count: 8, interval: 0.34, path: 1 },
    ],
  ],
  2,
);

// ── 递进关卡 4–6 ─────────────────────────────────────────────────────────
// 复杂度递进：2 路 / 3 路 / 4 路，尺寸 20×12 → 24×14 → 26×16，
// 波数 18 → 20 → 24，HP 曲线逐级放缓，避免长局后期数值失控。

/**
 * Stage-based wave composer. Early waves stay light, new mechanics are
 * introduced one at a time, and the last wave always fields every enemy type.
 * `tier` scales density slightly for the later maps.
 */
function composeWaves(count: number, paths: number, tier: number): WaveGroup[][] {
  const out: WaveGroup[][] = [];
  const n = (base: number, w: number) =>
    Math.max(2, Math.round(base * (1 + w * 0.022 + tier * 0.04)));

  for (let w = 0; w < count; w++) {
    const groups: WaveGroup[] = [];
    // Routes open progressively: one lane for the first four waves, then one
    // more every four waves. The finale uses every route at once.
    const active = w === count - 1 ? paths : Math.min(paths, 1 + Math.floor(w / 5));
    let slot = w;
    const route = () => (active > 1 ? slot++ % active : undefined);
    const add = (kind: EnemyKind, base: number, interval: number) => {
      groups.push({ kind, count: n(base, w), interval, path: route() });
    };

    if (w === count - 1) {
      // Final wave: all nine enemy types, spread across every route.
      const finale: { kind: EnemyKind; count: number; interval: number }[] = [
        { kind: "grunt", count: n(7, w), interval: 0.4 },
        { kind: "runner", count: n(8, w), interval: 0.3 },
        { kind: "armored", count: n(4, w), interval: 0.7 },
        { kind: "moth", count: n(7, w), interval: 0.36 },
        { kind: "warden", count: 2 + tier, interval: 1.0 },
        { kind: "shade", count: n(4, w), interval: 0.46 },
        { kind: "brood", count: n(2, w), interval: 0.8 },
        { kind: "spore", count: n(5, w), interval: 0.3 },
        { kind: "boss", count: tier >= 2 ? 2 : 1, interval: 0.2 },
      ];
      for (const group of finale) groups.push({ ...group, path: route() });
    } else if (w < 3) {
      // Opening: one lane, light pressure, time to build an economy.
      add("grunt", 5, 0.85);
      if (w >= 1) add("runner", 4, 0.62);
      if (w >= 2) add("grunt", 5, 0.6);
    } else if (w < 6) {
      // Armour and air arrive before any special unit.
      add("armored", 3, 0.95);
      add("moth", 5, 0.5);
      if (w >= 4) add("grunt", 5, 0.5);
    } else if (w < 10) {
      // Specials introduced one at a time: aura, then phase, then split.
      if (w % 2 === 0) add("warden", 1, 1.2);
      add("runner", 5, 0.4);
      if (w >= 7) add("shade", 3, 0.55);
      if (w >= 9) add("brood", 2, 0.95);
    } else {
      // Late game: mixed multi-route pushes with a boss every five waves.
      // Boss debuts at wave 13, not on the same wave a third route opens.
      if (w >= 13 && (w - 13) % 5 === 0) add("boss", 1, 0.2);
      if (w % 2 === 0) add("warden", 1 + Math.floor(tier / 2), 1.05);
      add("grunt", 6, 0.4);
      add("runner", 6, 0.32);
      add(w % 3 === 0 ? "moth" : "armored", 4, 0.46);
      if (w >= 14) add("shade", 3, 0.44);
      if (w >= 17) add("brood", 2, 0.85);
    }
    out.push(groups);
  }
  return out;
}

// 关卡 4：棘环迷阵 — 20×12，2 条路径在中段交叉、末段汇合，18 波
const mazeCols = 20;
const mazeRows = 12;
const mazeA: Pt[] = [
  left(2),
  corner(4, 2),
  corner(4, 5),
  corner(10, 5),
  corner(10, 2),
  corner(15, 2),
  corner(15, 6),
  corner(17, 6),
  exit(mazeCols, 6),
];
const mazeB: Pt[] = [
  left(9),
  corner(3, 9),
  corner(3, 7),
  corner(9, 7),
  corner(9, 10),
  corner(14, 10),
  corner(14, 6),
  corner(17, 6),
  exit(mazeCols, 6),
];

// 关卡 5：三岔棘庭 — 24×14，3 个出生点（左 / 上 / 左下），20 波
const triCols = 24;
const triRows = 14;
const triA: Pt[] = [
  left(2),
  corner(5, 2),
  corner(5, 4),
  corner(12, 4),
  corner(12, 2),
  corner(18, 2),
  corner(18, 7),
  corner(21, 7),
  exit(triCols, 7),
];
const triB: Pt[] = [
  top(11),
  corner(11, 2),
  corner(11, 6),
  corner(16, 6),
  corner(16, 9),
  corner(20, 9),
  corner(20, 7),
  corner(21, 7),
  exit(triCols, 7),
];
const triC: Pt[] = [
  left(12),
  corner(4, 12),
  corner(4, 10),
  corner(10, 10),
  corner(10, 12),
  corner(15, 12),
  corner(15, 7),
  corner(21, 7),
  exit(triCols, 7),
];

// 关卡 6：金门终局 — 26×16，4 个出生点（左上 / 上 / 下 / 左），24 波
const finalCols = 26;
const finalRows = 16;
const finalA: Pt[] = [
  left(1),
  corner(6, 1),
  corner(6, 3),
  corner(13, 3),
  corner(13, 1),
  corner(20, 1),
  corner(20, 8),
  corner(23, 8),
  exit(finalCols, 8),
];
const finalB: Pt[] = [
  top(3),
  corner(3, 3),
  corner(3, 7),
  corner(9, 7),
  corner(9, 5),
  corner(17, 5),
  corner(17, 8),
  corner(23, 8),
  exit(finalCols, 8),
];
const finalC: Pt[] = [
  bottom(finalRows, 6),
  corner(6, 14),
  corner(6, 11),
  corner(12, 11),
  corner(12, 14),
  corner(19, 14),
  corner(19, 8),
  corner(23, 8),
  exit(finalCols, 8),
];
const finalD: Pt[] = [
  left(9),
  corner(4, 9),
  corner(4, 8),
  corner(8, 8),
  corner(8, 10),
  corner(14, 10),
  corner(14, 8),
  corner(23, 8),
  exit(finalCols, 8),
];

export const LEVELS: Level[] = [
  {
    id: "classic",
    name: "金棘古道",
    blurb: "原始防线，稳扎稳打",
    cols: 16,
    rows: 10,
    paths: [PATH],
    waves: classicWaves,
    hpCurve: 0.14,
  },
  {
    id: "fold",
    name: "折棘回廊",
    blurb: "全新折返土路，高速与飞行早期混编",
    cols: 16,
    rows: 10,
    paths: [buildPoly(foldWaypoints)],
    waves: foldWaves,
    hpCurve: 0.14,
  },
  {
    id: "twin",
    name: "双门长径",
    blurb: "大地图双线告急，两处出生点同时来敌",
    cols: twinCols,
    rows: twinRows,
    paths: [buildPoly(upperWaypoints), buildPoly(lowerWaypoints)],
    waves: twinWaves,
    hpCurve: 0.14,
  },
  {
    id: "maze",
    name: "棘环迷阵",
    blurb: "双线交叉，护盾光环与潜行者首次登场",
    cols: mazeCols,
    rows: mazeRows,
    paths: [buildPoly(mazeA), buildPoly(mazeB)],
    waves: composeWaves(18, 2, 0),
    hpCurve: 0.09,
  },
  {
    id: "tri",
    name: "三岔棘庭",
    blurb: "三处出生点齐发，孢母分裂体涌入三条土路",
    cols: triCols,
    rows: triRows,
    paths: [buildPoly(triA), buildPoly(triB), buildPoly(triC)],
    waves: composeWaves(20, 3, 1),
    hpCurve: 0.08,
  },
  {
    id: "finale",
    name: "金门终局",
    blurb: "26×16 四线合围，24 波全类型最终防线",
    cols: finalCols,
    rows: finalRows,
    paths: [buildPoly(finalA), buildPoly(finalB), buildPoly(finalC), buildPoly(finalD)],
    waves: composeWaves(24, 4, 2),
    hpCurve: 0.07,
  },
];
