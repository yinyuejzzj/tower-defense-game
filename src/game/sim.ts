import { sfx } from "./audio";
import {
  CELL,
  ENEMIES,
  MAX_RANK,
  SAVE_KEY,
  SELECT_KEY,
  SELL_RATIO,
  START_GOLD,
  START_LIVES,
  TOWERS,
  type EnemyKind,
  type Phase,
  type Poly,
  type TargetMode,
  type TowerKind,
  cellBuildable,
  cellCenter,
  dmgMult,
  rateMult,
  samplePath,
  upgradeCost,
  waveBonus,
  lerpAngle,
} from "./data";
import { DIFFICULTY, LEVELS, type Difficulty, type Level } from "./levels";

export type Tower = {
  id: number;
  kind: TowerKind;
  c: number;
  r: number;
  dmg: number;
  rate: number;
  spent: number;
  cool: number;
  angle: number;
  aim: TargetMode;
};

export type DotState = { dps: number; t: number; melt: number };

export type Enemy = {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  dist: number;
  slow: number;
  slowT: number;
  hit: number;
  gold: number;
  alive: boolean;
  pathIndex: number;
  /** Special-mechanic state. All zero/empty on the original five enemy types. */
  shield: number;
  shieldMax: number;
  hidden: boolean;
  phaseT: number;
  dot: DotState | null;
  shredT: number;
};

export type Shot = {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  splash: number;
  slow: number;
  slowTime: number;
  pierce: boolean;
  ttl: number;
  targetId: number;
  alive: boolean;
  dot?: { dps: number; time: number; shred: number; melt: number };
};

export type Beam = { points: { x: number; y: number }[]; life: number; max: number };

export type FloatText = {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
};

type Spawn = { kind: EnemyKind; at: number; pathIndex: number };
type LevelRecord = { bestCleared: number; wins: number };
type Meta = { v: number; bestCleared?: number; wins?: number; levels?: Record<string, LevelRecord> };
type Selection = { levelId: string; difficulty: Difficulty };

export class Game {
  level: Level = LEVELS[0]!;
  difficulty: Difficulty = "normal";
  gold = START_GOLD;
  lives = START_LIVES;
  wave = 0;
  phase: Phase = "menu";
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  beams: Beam[] = [];
  floats: FloatText[] = [];
  selectedId: number | null = null;
  placing: TowerKind | null = null;
  hover: { c: number; r: number } | null = null;
  speed = 1;
  paused = false;
  kills = 0;
  earned = 0;
  leaked = 0;
  shake = 0;
  time = 0;
  toast = "";
  bestCleared = 0;
  wins = 0;
  private spawn: Spawn[] = [];
  private clock = 0;
  private acc = 0;
  private hudTick = 0;
  private auraTick = 0;
  private toastT = 0;
  private nextId = 1;
  private dirty = false;
  private records: Record<string, LevelRecord> = {};
  rev = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.loadMeta();
    this.loadSelection();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private ping() {
    this.dirty = false;
    this.rev += 1;
    for (const fn of this.listeners) fn();
  }

  private mark() {
    this.dirty = true;
  }

  /** v2 records are per level; a legacy v1 save is migrated to the classic map. */
  loadMeta() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Meta;
        if (data.v === 2 && data.levels) {
          this.records = { ...data.levels };
        } else if (data.v === 1) {
          this.records = {
            [LEVELS[0]!.id]: { bestCleared: data.bestCleared ?? 0, wins: data.wins ?? 0 },
          };
        }
      }
    } catch {
      /* ignore broken saves */
    }
    this.syncRecord();
  }

  private saveMeta() {
    if (typeof window === "undefined") return;
    const payload: Meta = { v: 2, levels: this.records };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
  }

  private loadSelection() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SELECT_KEY);
      if (raw) {
        const sel = JSON.parse(raw) as Selection;
        const level = LEVELS.find((item) => item.id === sel.levelId);
        if (level) this.level = level;
        if (sel.difficulty === "normal" || sel.difficulty === "hard") this.difficulty = sel.difficulty;
      }
    } catch {
      /* ignore broken selections */
    }
    this.syncRecord();
  }

  private saveSelection() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        SELECT_KEY,
        JSON.stringify({ levelId: this.level.id, difficulty: this.difficulty }),
      );
    } catch {
      /* ignore quota */
    }
  }

  private syncRecord() {
    const record = this.records[this.level.id] ?? { bestCleared: 0, wins: 0 };
    this.bestCleared = record.bestCleared;
    this.wins = record.wins;
  }

  private noteRecord(cleared: number, win = false) {
    const record = this.records[this.level.id] ?? { bestCleared: 0, wins: 0 };
    record.bestCleared = Math.max(record.bestCleared, cleared);
    if (win) record.wins += 1;
    this.records[this.level.id] = record;
    this.bestCleared = record.bestCleared;
    this.wins = record.wins;
    this.saveMeta();
  }

  get waveCount() {
    return this.level.waves.length;
  }

  get remaining() {
    return this.enemies.length + this.spawn.length;
  }

  get selected() {
    return this.towers.find((tower) => tower.id === this.selectedId) ?? null;
  }

  /** Reset every in-run field but keep the selected level and difficulty. */
  private resetState(phase: Phase) {
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.wave = 0;
    this.phase = phase;
    this.towers = [];
    this.enemies = [];
    this.shots = [];
    this.beams = [];
    this.floats = [];
    this.spawn = [];
    this.selectedId = null;
    this.placing = null;
    this.hover = null;
    this.speed = 1;
    this.paused = false;
    this.kills = 0;
    this.earned = 0;
    this.leaked = 0;
    this.shake = 0;
    this.time = 0;
    this.clock = 0;
    this.acc = 0;
    this.hudTick = 0;
    this.auraTick = 0;
    this.nextId = 1;
    this.toast = "";
    this.toastT = 0;
    this.ping();
  }

  /** "重新开始本局" — back to the current level's initial prep phase. */
  restart() {
    this.resetState("prep");
  }

  /** Level / difficulty changes return to the title so the player can review. */
  setLevel(id: string) {
    const level = LEVELS.find((item) => item.id === id);
    if (!level || level.id === this.level.id) return;
    this.level = level;
    this.saveSelection();
    this.syncRecord();
    this.resetState("menu");
  }

  setDifficulty(value: Difficulty) {
    if (!DIFFICULTY[value] || value === this.difficulty) return;
    this.difficulty = value;
    this.saveSelection();
    this.resetState("menu");
  }

  toMenu() {
    this.phase = "menu";
    this.paused = false;
    this.placing = null;
    this.ping();
  }

  pickTower(kind: TowerKind) {
    if (this.phase === "menu" || this.phase === "won" || this.phase === "lost") return;
    this.placing = this.placing === kind ? null : kind;
    if (this.placing) this.selectedId = null;
    this.ping();
  }

  cancelPlace() {
    if (!this.placing && !this.selectedId) return;
    this.placing = null;
    this.selectedId = null;
    this.ping();
  }

  togglePause() {
    if (this.phase !== "prep" && this.phase !== "combat") return;
    this.paused = !this.paused;
    this.ping();
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.ping();
  }

  setAim(mode: TargetMode) {
    const tower = this.selected;
    if (!tower) return;
    tower.aim = mode;
    this.ping();
  }

  startWave() {
    if (this.phase !== "prep") return;
    const groups = this.level.waves[this.wave];
    if (!groups) return;
    this.phase = "combat";
    this.paused = false;
    this.clock = 0;
    this.spawn = [];
    let at = 0.45;
    const intervalScale = DIFFICULTY[this.difficulty].intervalScale;
    for (const group of groups) {
      const pathIndex = Math.min(Math.max(0, group.path ?? 0), this.level.paths.length - 1);
      for (let i = 0; i < group.count; i++) {
        this.spawn.push({ kind: group.kind, at, pathIndex });
        at += group.interval * intervalScale;
      }
      at += 0.8;
    }
    sfx.wave();
    this.ping();
  }

  pointer(x: number, y: number, kind: "move" | "down") {
    if (this.phase === "menu" || this.phase === "won" || this.phase === "lost") return;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    const inside =
      x >= 0 &&
      y >= 0 &&
      x < this.level.cols * CELL &&
      y < this.level.rows * CELL &&
      c >= 0 &&
      r >= 0 &&
      c < this.level.cols &&
      r < this.level.rows;
    this.hover = inside ? { c, r } : null;
    if (kind === "move") return;
    if (!inside) {
      this.ping();
      return;
    }
    if (this.placing) {
      this.tryPlace(c, r);
      return;
    }
    const hit = [...this.towers].reverse().find((tower) => {
      const p = cellCenter(tower.c, tower.r);
      return Math.hypot(p.x - x, p.y - y) <= CELL * 0.46;
    });
    this.selectedId = hit ? hit.id : null;
    this.ping();
  }

  clearHover() {
    if (!this.hover) return;
    this.hover = null;
  }

  canPlace(c: number, r: number) {
    if (!cellBuildable(c, r, this.level.paths, this.level.cols, this.level.rows)) return false;
    return !this.towers.some((tower) => tower.c === c && tower.r === r);
  }

  /** Route an enemy belongs to, and its current world position. */
  pathOf(enemy: Enemy): Poly {
    return this.level.paths[enemy.pathIndex] ?? this.level.paths[0]!;
  }

  enemyPos(enemy: Enemy) {
    return samplePath(enemy.dist, this.pathOf(enemy));
  }

  private toastMsg(text: string) {
    this.toast = text;
    this.toastT = 1.5;
    this.ping();
  }

  private tryPlace(c: number, r: number) {
    const kind = this.placing;
    if (!kind) return;
    if (!this.canPlace(c, r)) {
      this.toastMsg("土路和已有的塔上不能建造");
      return;
    }
    const cost = TOWERS[kind].cost;
    if (this.gold < cost) {
      this.toastMsg("金币不足");
      return;
    }
    this.gold -= cost;
    const tower: Tower = {
      id: this.nextId++,
      kind,
      c,
      r,
      dmg: 0,
      rate: 0,
      spent: cost,
      cool: 0.15,
      angle: -Math.PI / 2,
      aim: "first",
    };
    this.towers.push(tower);
    this.selectedId = tower.id;
    sfx.place();
    this.ping();
  }

  upgrade(kind: "dmg" | "rate") {
    const tower = this.selected;
    if (!tower) return;
    const level = kind === "dmg" ? tower.dmg : tower.rate;
    if (level >= MAX_RANK) return;
    const cost = upgradeCost(TOWERS[tower.kind].cost, level, kind);
    if (this.gold < cost) {
      this.toastMsg("金币不足");
      return;
    }
    this.gold -= cost;
    tower.spent += cost;
    if (kind === "dmg") tower.dmg += 1;
    else tower.rate += 1;
    sfx.upgrade();
    this.ping();
  }

  sell() {
    const index = this.towers.findIndex((tower) => tower.id === this.selectedId);
    if (index < 0) return;
    const tower = this.towers[index]!;
    const refund = Math.floor(tower.spent * SELL_RATIO);
    this.gold += refund;
    this.towers.splice(index, 1);
    this.selectedId = null;
    this.floats.push({
      x: cellCenter(tower.c, tower.r).x,
      y: cellCenter(tower.c, tower.r).y,
      text: `+${refund}`,
      life: 0.8,
      max: 0.8,
    });
    sfx.sell();
    this.ping();
  }

  step(rawDt: number) {
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.time += dt;
    const frozen = this.paused || this.phase === "menu" || this.phase === "won" || this.phase === "lost";
    if (frozen) {
      this.decayFx(dt);
      if (this.dirty) this.ping();
      return;
    }
    this.acc += dt * this.speed;
    const step = 1 / 60;
    let ticks = 0;
    while (this.acc >= step && ticks < 8) {
      this.acc -= step;
      this.tick(step);
      ticks += 1;
      if (this.phase !== "prep" && this.phase !== "combat") break;
    }
    if (ticks === 8) this.acc = 0;
    if (this.dirty) this.ping();
  }

  private tick(dt: number) {
    if (this.phase === "combat") {
      this.clock += dt;
      while (this.spawn.length > 0 && this.spawn[0]!.at <= this.clock) {
        const next = this.spawn.shift()!;
        this.createEnemy(next.kind, next.pathIndex, 0);
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.slowT > 0) {
        enemy.slowT -= dt;
        if (enemy.slowT <= 0) enemy.slow = 1;
      }
      if (enemy.shredT > 0) enemy.shredT = Math.max(0, enemy.shredT - dt);
      const spec = ENEMIES[enemy.kind];

      // Phase behaviour: shade alternates between targetable and untargetable.
      if (spec.behavior === "phase" && spec.phase) {
        enemy.phaseT -= dt;
        if (enemy.phaseT <= 0) {
          enemy.hidden = !enemy.hidden;
          enemy.phaseT = enemy.hidden ? spec.phase.hidden : spec.phase.visible;
        }
      }

      // Corrosion damage-over-time keeps ticking through stealth and out of range.
      if (enemy.dot) {
        enemy.dot.t -= dt;
        this.applyDamage(enemy, enemy.dot.dps * dt, {
          pierce: true,
          melt: enemy.dot.melt,
          flash: false,
        });
        if (enemy.dot.t <= 0) enemy.dot = null;
        if (enemy.hp <= 0) {
          this.killEnemy(enemy, this.enemyPos(enemy));
          continue;
        }
      }

      const poly = this.pathOf(enemy);
      enemy.dist += spec.speed * enemy.slow * dt;
      enemy.hit = Math.max(0, enemy.hit - dt);
      if (enemy.dist >= poly.total) {
        enemy.alive = false;
        this.lives -= spec.leak;
        this.leaked += spec.leak;
        this.shake = Math.min(16, this.shake + (spec.leak > 1 ? 10 : 6));
        const end = samplePath(poly.total - 36, poly);
        this.floats.push({ x: end.x, y: end.y - 12, text: `-${spec.leak}`, life: 0.9, max: 0.9 });
        sfx.leak();
        if (this.lives <= 0) {
          this.lives = 0;
          this.phase = "lost";
          this.spawn = [];
          this.noteRecord(this.wave);
          sfx.lose();
        }
        this.mark();
      }
    }

    // Aura refresh is throttled to keep multi-route long maps cheap.
    this.auraTick += dt;
    if (this.auraTick >= 0.2) {
      this.refreshAuras(this.auraTick);
      this.auraTick = 0;
    }

    if (this.phase === "combat" || this.phase === "prep") {
      for (const tower of this.towers) {
        this.aimTower(tower, dt);
      }
    }

    for (const shot of this.shots) {
      if (!shot.alive) continue;
      this.flyShot(shot, dt);
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    this.shots = this.shots.filter((shot) => shot.alive);

    if (this.phase === "combat" && this.spawn.length === 0 && this.enemies.length === 0) {
      const bonus = waveBonus(this.wave);
      this.gold += bonus;
      this.earned += bonus;
      const gatePoly = this.level.paths[0]!;
      const gate = samplePath(gatePoly.total - 90, gatePoly);
      this.floats.push({ x: gate.x - 40, y: gate.y - 28, text: `+${bonus}`, life: 1.1, max: 1.1 });
      this.noteRecord(this.wave + 1, this.wave + 1 >= this.level.waves.length);
      sfx.clear();
      this.wave += 1;
      if (this.wave >= this.level.waves.length) {
        this.phase = "won";
        sfx.win();
      } else {
        this.phase = "prep";
      }
      this.mark();
    }

    this.decayFx(dt);
    this.hudTick += dt;
    if (this.hudTick >= 0.25 && this.phase === "combat") {
      this.hudTick = 0;
      this.mark();
    }
  }

  /** Wardens continuously top up shields on nearby allies, including themselves. */
  private refreshAuras(dt: number) {
    const wardens = this.enemies.filter((enemy) => enemy.alive && ENEMIES[enemy.kind].behavior === "aura");
    if (wardens.length === 0) return;
    for (const warden of wardens) {
      const aura = ENEMIES[warden.kind].aura;
      if (!aura) continue;
      const origin = this.enemyPos(warden);
      const radius = aura.radius * CELL;
      const cap = aura.shield * (1 + this.wave * 0.05);
      for (const ally of this.enemies) {
        if (!ally.alive) continue;
        const pos = this.enemyPos(ally);
        if ((pos.x - origin.x) ** 2 + (pos.y - origin.y) ** 2 > radius * radius) continue;
        ally.shieldMax = Math.max(ally.shieldMax, cap);
        ally.shield = Math.min(ally.shieldMax, ally.shield + aura.regen * dt);
      }
    }
  }

  /** Build an enemy. `dist` lets splitters spawn offspring at the parent's location. */
  private createEnemy(kind: EnemyKind, pathIndex: number, dist = 0) {
    const spec = ENEMIES[kind];
    const scale = (1 + this.wave * this.level.hpCurve) * DIFFICULTY[this.difficulty].hpScale;
    const hp = spec.hp * scale;
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      hp,
      maxHp: hp,
      dist,
      slow: 1,
      slowT: 0,
      hit: 0,
      gold: Math.round(spec.gold * (1 + this.wave * 0.05)),
      alive: true,
      pathIndex,
      shield: 0,
      shieldMax: 0,
      hidden: false,
      phaseT: spec.phase?.visible ?? 0,
      dot: null,
      shredT: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  /** Public alias used by the wave spawner and by splitters. */
  spawnEnemy(kind: EnemyKind, pathIndex: number) {
    return this.createEnemy(kind, pathIndex, 0);
  }

  /** Armour after corrosion shred; pierce bypasses it entirely. */
  private effectiveArmor(enemy: Enemy) {
    const base = ENEMIES[enemy.kind].armor;
    return enemy.shredT > 0 ? base * 0.6 : base;
  }

  /**
   * Single damage pipeline for projectiles, splash, chains and corrosion.
   * Shield absorbs first; `melt` multiplies shield damage (3× for acid).
   */
  private applyDamage(
    enemy: Enemy,
    raw: number,
    opts: { pierce: boolean; melt: number; flash?: boolean },
  ) {
    if (!enemy.alive || raw <= 0) return;
    let damage = opts.pierce ? raw : raw * (1 - this.effectiveArmor(enemy));
    if (enemy.shield > 0) {
      const shieldDamage = damage * opts.melt;
      const absorbed = Math.min(enemy.shield, shieldDamage);
      enemy.shield -= absorbed;
      damage = Math.max(0, damage - absorbed / opts.melt);
    }
    enemy.hp -= damage;
    if (opts.flash !== false) enemy.hit = 0.12;
  }

  private killEnemy(enemy: Enemy, pos: { x: number; y: number }) {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.gold += enemy.gold;
    this.earned += enemy.gold;
    this.kills += 1;
    this.floats.push({ x: pos.x, y: pos.y - 16, text: `+${enemy.gold}`, life: 0.75, max: 0.75 });
    sfx.kill();
    this.mark();
    const split = ENEMIES[enemy.kind].split;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.createEnemy(split.kind, enemy.pathIndex, Math.max(0, enemy.dist - 14 - i * 10));
      }
      this.floats.push({ x: pos.x, y: pos.y - 30, text: "分裂!", life: 0.8, max: 0.8 });
    }
  }

  private aimTower(tower: Tower, dt: number) {
    const def = TOWERS[tower.kind];
    const range = def.range * CELL;
    const origin = cellCenter(tower.c, tower.r);
    // Area/chain/acid weapons sense phased units; single-target bolts do not.
    const sensesHidden =
      def.mechanic === "chain" || def.mechanic === "corrode" || def.splash > 0;
    const target = this.pickTarget(origin.x, origin.y, range, tower.aim, sensesHidden);
    tower.cool -= dt;
    if (!target) return;
    const pos = this.enemyPos(target);
    const ang = Math.atan2(pos.y - origin.y, pos.x - origin.x);
    tower.angle = lerpAngle(tower.angle, ang, 1 - Math.exp(-12 * dt));
    const interval = 1 / (def.rate * rateMult(tower.rate));
    if (tower.cool <= 0) {
      tower.cool += interval;
      if (tower.cool < 0) tower.cool = 0;
      this.fire(tower, target, origin, ang);
    }
  }

  /** Hidden enemies cannot be locked on by any single-target weapon. */
  private pickTarget(
    x: number,
    y: number,
    range: number,
    aim: TargetMode,
    includeHidden = false,
  ) {
    const r2 = range * range;
    let best: Enemy | null = null;
    let score = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive || (enemy.hidden && !includeHidden)) continue;
      const pos = this.enemyPos(enemy);
      const d2 = (pos.x - x) ** 2 + (pos.y - y) ** 2;
      if (d2 > r2) continue;
      const value = aim === "first" ? enemy.dist : aim === "near" ? -d2 : enemy.hp;
      if (!best || value > score) {
        best = enemy;
        score = value;
      }
    }
    return best;
  }

  private fire(tower: Tower, target: Enemy, origin: { x: number; y: number }, ang: number) {
    const def = TOWERS[tower.kind];
    if (def.mechanic === "chain" && def.chain) {
      this.fireChain(tower, target, origin);
      return;
    }
    const muzzle = CELL * 0.28;
    const shot: Shot = {
      id: this.nextId++,
      kind: tower.kind,
      x: origin.x + Math.cos(ang) * muzzle,
      y: origin.y + Math.sin(ang) * muzzle,
      vx: Math.cos(ang) * def.shotSpeed,
      vy: Math.sin(ang) * def.shotSpeed,
      speed: def.shotSpeed,
      damage: def.damage * dmgMult(tower.dmg),
      splash: def.splash * CELL,
      slow: def.slow,
      slowTime: def.slowTime,
      pierce: def.pierce,
      ttl: 1.5,
      targetId: target.id,
      alive: true,
    };
    if (def.mechanic === "corrode" && def.dot) {
      shot.dot = {
        dps: def.dot.dps * dmgMult(tower.dmg),
        time: def.dot.time,
        shred: def.dot.shred,
        melt: def.dot.shieldMelt,
      };
    }
    this.shots.push(shot);
    sfx.shoot(tower.kind);
  }

  /** Instant, projectile-less chain: jumps to nearby enemies, ignoring stealth and armour. */
  private fireChain(tower: Tower, target: Enemy, origin: { x: number; y: number }) {
    const def = TOWERS[tower.kind];
    const chain = def.chain!;
    const points: { x: number; y: number }[] = [{ x: origin.x, y: origin.y }];
    const hit = new Set<number>();
    let current: Enemy | null = target;
    let damage = def.damage * dmgMult(tower.dmg);
    const radius = chain.radius * CELL;

    for (let jump = 0; jump < chain.jumps && current; jump++) {
      hit.add(current.id);
      const pos = this.enemyPos(current);
      points.push({ x: pos.x, y: pos.y });
      this.applyDamage(current, damage, { pierce: true, melt: 1 });
      if (current.hp <= 0) this.killEnemy(current, pos);

      let next: Enemy | null = null;
      let bestScore = -Infinity;
      for (const enemy of this.enemies) {
        if (!enemy.alive || hit.has(enemy.id)) continue;
        const p = this.enemyPos(enemy);
        if ((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2 > radius * radius) continue;
        const score = enemy.dist;
        if (score > bestScore) {
          bestScore = score;
          next = enemy;
        }
      }
      current = next;
      damage *= chain.falloff;
    }

    this.beams.push({ points, life: 0.18, max: 0.18 });
    sfx.shoot(tower.kind);
    sfx.arcHit();
  }

  private flyShot(shot: Shot, dt: number) {
    shot.ttl -= dt;
    const target = this.enemies.find((enemy) => enemy.id === shot.targetId && enemy.alive);
    if (target) {
      const pos = this.enemyPos(target);
      const dx = pos.x - shot.x;
      const dy = pos.y - shot.y;
      const mag = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-10 * dt);
      shot.vx += ((dx / mag) * shot.speed - shot.vx) * k;
      shot.vy += ((dy / mag) * shot.speed - shot.vy) * k;
      if (mag < 14) {
        // Single-target bolts miss a phasing enemy; acid globules still land.
        if (target.hidden && shot.splash === 0 && !shot.dot) {
          shot.alive = false;
          return;
        }
        this.impact(shot, pos.x, pos.y);
        return;
      }
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (enemy.hidden && shot.splash === 0 && !shot.dot) continue;
      const pos = this.enemyPos(enemy);
      if ((pos.x - shot.x) ** 2 + (pos.y - shot.y) ** 2 < 16 * 16) {
        this.impact(shot, shot.x, shot.y);
        return;
      }
    }
    if (shot.ttl <= 0) {
      if (shot.splash > 0) this.impact(shot, shot.x, shot.y);
      else shot.alive = false;
    }
  }

  private impact(shot: Shot, x: number, y: number) {
    if (!shot.alive) return;
    shot.alive = false;
    if (shot.dot) sfx.venomHit();
    const radius = shot.splash > 0 ? shot.splash : 20;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      // Splash reaches phased enemies; plain single-target bolts do not.
      if (enemy.hidden && shot.splash === 0 && !shot.dot) continue;
      const pos = this.enemyPos(enemy);
      const dist = Math.hypot(pos.x - x, pos.y - y);
      if (dist > radius) continue;
      if (shot.splash === 0 && enemy.id !== shot.targetId && dist > 18) continue;
      let damage = shot.damage;
      if (shot.splash > 0) damage *= 1 - (dist / radius) * 0.5;
      const melt = shot.dot ? shot.dot.melt : 1;
      this.applyDamage(enemy, damage, { pierce: shot.pierce, melt });
      if (shot.slow < 1) {
        enemy.slow = Math.min(enemy.slow, shot.slow);
        enemy.slowT = Math.max(enemy.slowT, shot.slowTime);
      }
      if (shot.dot) {
        enemy.dot = { dps: shot.dot.dps, t: shot.dot.time, melt: shot.dot.melt };
        enemy.shredT = Math.max(enemy.shredT, shot.dot.time);
      }
      if (enemy.hp <= 0) this.killEnemy(enemy, pos);
    }
  }

  private decayFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 22);
    for (const floater of this.floats) {
      floater.life -= dt;
      floater.y -= 22 * dt;
    }
    if (this.floats.some((floater) => floater.life <= 0)) {
      this.floats = this.floats.filter((floater) => floater.life > 0);
    }
    if (this.beams.length > 0) {
      for (const beam of this.beams) beam.life -= dt;
      this.beams = this.beams.filter((beam) => beam.life > 0);
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) {
        this.toast = "";
        this.mark();
      }
    }
  }
}
