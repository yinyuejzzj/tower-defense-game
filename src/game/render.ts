import {
  CELL,
  ENEMIES,
  SPRITE_ENEMIES,
  SPRITE_TOWERS,
  TOWERS,
  cellCenter,
  samplePath,
  type Poly,
  type TowerKind,
} from "./data";
import type { Beam, Enemy, Game, Shot, Tower } from "./sim";

export type View = {
  dpr: number;
  scale: number;
  ox: number;
  oy: number;
  cssW: number;
  cssH: number;
};

type Art = {
  grass: HTMLImageElement | null;
  dirt: HTMLImageElement | null;
  towers: Record<TowerKind, HTMLImageElement | null>;
  enemies: Record<string, HTMLImageElement | null>;
};

const art: Art = {
  grass: null,
  dirt: null,
  towers: { bow: null, hive: null, frost: null, cannon: null, ballista: null, arc: null, venom: null },
  enemies: {
    grunt: null,
    runner: null,
    armored: null,
    moth: null,
    boss: null,
    warden: null,
    shade: null,
    brood: null,
    spore: null,
  },
};

let grassPat: CanvasPattern | null = null;
let dirtPat: CanvasPattern | null = null;
let booted = false;
let reduceMotion = false;

function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";
  image.src = src;
  return image;
}

export function bootArt() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  art.grass = loadImage("/art/grass.jpg");
  art.dirt = loadImage("/art/dirt.jpg");
  for (const kind of SPRITE_TOWERS) {
    art.towers[kind] = loadImage(`/art/${kind}.png`);
  }
  for (const kind of SPRITE_ENEMIES) {
    art.enemies[kind] = loadImage(`/art/${kind}.png`);
  }
  art.enemies.boss = loadImage("/art/armored.png");
}

function ready(image: HTMLImageElement | null) {
  return !!image && image.complete && image.naturalWidth > 0;
}

function strokePath(ctx: CanvasRenderingContext2D, poly: Poly) {
  const pts = poly.pts;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.stroke();
}

export function render(ctx: CanvasRenderingContext2D, game: Game, view: View) {
  bootArt();
  const { dpr, scale, ox, oy, cssW, cssH } = view;
  const worldW = game.level.cols * CELL;
  const worldH = game.level.rows * CELL;
  const polys = game.level.paths;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0c1210";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);

  ctx.save();
  if (game.shake > 0.4 && !reduceMotion) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  if (!grassPat && ready(art.grass)) grassPat = ctx.createPattern(art.grass!, "repeat");
  if (!dirtPat && ready(art.dirt)) dirtPat = ctx.createPattern(art.dirt!, "repeat");

  ctx.fillStyle = grassPat ?? "#2a4630";
  ctx.fillRect(0, 0, worldW, worldH);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(86, 120, 48, 0.28)";
  ctx.fillRect(0, 0, worldW, worldH);
  ctx.restore();

  // All routes are stroked in passes so shared segments do not brighten.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = CELL * 1.02;
  for (const poly of polys) strokePath(ctx, poly);
  ctx.strokeStyle = (dirtPat as CanvasPattern | null) ?? "#a9784e";
  ctx.lineWidth = CELL * 0.78;
  for (const poly of polys) strokePath(ctx, poly);
  ctx.strokeStyle = "rgba(255, 224, 176, 0.28)";
  ctx.lineWidth = CELL * 0.1;
  for (const poly of polys) strokePath(ctx, poly);

  if (game.placing && (game.phase === "prep" || game.phase === "combat")) {
    for (let r = 0; r < game.level.rows; r++) {
      for (let c = 0; c < game.level.cols; c++) {
        if (!game.canPlace(c, r)) continue;
        ctx.fillStyle = "rgba(143, 191, 114, 0.18)";
        ctx.fillRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
      }
    }
  }

  // One gate per distinct exit; one spawn marker per independent route.
  const drawnGates: { x: number; y: number }[] = [];
  for (const poly of polys) {
    const gate = samplePath(poly.total - 70, poly);
    if (drawnGates.some((item) => Math.hypot(item.x - gate.x, item.y - gate.y) < 24)) continue;
    drawnGates.push({ x: gate.x, y: gate.y });
    drawGate(ctx, gate.x, gate.y, game.time);
  }
  const drawnSpawns: { x: number; y: number }[] = [];
  for (const poly of polys) {
    const spawn = samplePath(36, poly);
    if (drawnSpawns.some((item) => Math.hypot(item.x - spawn.x, item.y - spawn.y) < 24)) continue;
    drawnSpawns.push({ x: spawn.x, y: spawn.y });
    drawSpawn(ctx, spawn.x, spawn.y, game.time);
  }

  if (game.placing && game.hover && (game.phase === "prep" || game.phase === "combat")) {
    const ok = game.canPlace(game.hover.c, game.hover.r) && game.gold >= TOWERS[game.placing].cost;
    const cx = game.hover.c * CELL;
    const cy = game.hover.r * CELL;
    ctx.strokeStyle = ok ? "rgba(143, 191, 114, 0.95)" : "rgba(209, 90, 74, 0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
    drawRange(ctx, cx + CELL / 2, cy + CELL / 2, TOWERS[game.placing].range * CELL, ok);
  }

  const selected = game.selected;
  if (selected) {
    const p = cellCenter(selected.c, selected.r);
    drawRange(ctx, p.x, p.y, TOWERS[selected.kind].range * CELL, true);
  }

  // Aura rings sit under units so they never obscure sprites.
  for (const enemy of game.enemies) {
    if (!enemy.alive || ENEMIES[enemy.kind].behavior !== "aura") continue;
    const aura = ENEMIES[enemy.kind].aura;
    if (!aura) continue;
    const p = game.enemyPos(enemy);
    drawAura(ctx, p.x, p.y, aura.radius * CELL, game.time);
  }

  const towers = [...game.towers].sort((a, b) => a.r - b.r || a.c - b.c);
  for (const tower of towers) drawTower(ctx, tower, tower.id === game.selectedId, 1, game.time);

  if (game.placing && game.hover && game.canPlace(game.hover.c, game.hover.r)) {
    drawTower(
      ctx,
      {
        id: -1,
        kind: game.placing,
        c: game.hover.c,
        r: game.hover.r,
        dmg: 0,
        rate: 0,
        spent: 0,
        cool: 0,
        angle: -Math.PI / 2,
        aim: "first",
      },
      false,
      0.62,
      game.time,
    );
  }

  const drawn = game.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => ({ enemy, pos: game.enemyPos(enemy) }))
    .sort((a, b) => a.pos.y - b.pos.y);
  for (const item of drawn) drawEnemy(ctx, item.enemy, item.pos, game.time);

  for (const beam of game.beams) drawBeam(ctx, beam);
  for (const shot of game.shots) {
    if (shot.alive) drawShot(ctx, shot);
  }

  ctx.font = "600 15px 'WenQuanYi Zen Hei', 'Noto Sans SC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const floater of game.floats) {
    ctx.globalAlpha = Math.max(0, floater.life / floater.max);
    ctx.fillStyle = floater.text.startsWith("-") ? "#ffb0a6" : "#f6e2a8";
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.globalAlpha = 1;

  const vignette = ctx.createRadialGradient(
    worldW / 2,
    worldH / 2,
    worldW * 0.28,
    worldW / 2,
    worldH / 2,
    worldW * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(6, 10, 8, 0.38)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, worldW, worldH);
  ctx.restore();
}

function drawRange(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, ok: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = ok ? "rgba(228, 176, 74, 0.08)" : "rgba(209, 90, 74, 0.1)";
  ctx.fill();
  ctx.setLineDash([7, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ok ? "rgba(228, 176, 74, 0.8)" : "rgba(209, 90, 74, 0.85)";
  ctx.stroke();
  ctx.restore();
}

function drawAura(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
  ctx.setLineDash([9, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(126, 200, 195, ${0.3 + pulse * 0.25})`;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(126, 200, 195, 0.055)";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
  glow.addColorStop(0, `rgba(228, 176, 74, ${0.35 + pulse * 0.4})`);
  glow.addColorStop(1, "rgba(228, 176, 74, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d9c7a4";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#e4b04a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, time * 0.8, time * 0.8 + Math.PI * 1.4);
  ctx.stroke();
  ctx.fillStyle = `rgba(255, 226, 170, ${0.75 + pulse * 0.25})`;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpawn(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(212, 101, 58, ${0.35 + 0.25 * Math.sin(time * 3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12 + Math.sin(time * 3) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  tower: Tower,
  selected: boolean,
  alpha = 1,
  time = 0,
) {
  const p = cellCenter(tower.c, tower.r);
  const image = art.towers[tower.kind];
  const size = CELL * 0.86;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  if (selected) {
    ctx.beginPath();
    ctx.arc(0, 0, CELL * 0.46, 0, Math.PI * 2);
    ctx.strokeStyle = "#e4b04a";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.rotate(tower.angle + Math.PI / 2);
  if (ready(image)) {
    ctx.drawImage(image!, -size / 2, -size / 2, size, size);
  } else if (tower.kind === "arc") {
    drawArcTower(ctx, size, time);
  } else if (tower.kind === "venom") {
    drawVenomTower(ctx, size, time);
  } else {
    ctx.fillStyle = "#244233";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hexagon(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawArcTower(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const r = size * 0.42;
  ctx.fillStyle = "#20332f";
  hexagon(ctx, r);
  ctx.fill();
  ctx.strokeStyle = "#7ec8c3";
  ctx.lineWidth = 2;
  hexagon(ctx, r);
  ctx.stroke();
  // Three prongs with a pulsing core, all in the tower's facing direction.
  const pulse = 0.65 + 0.35 * Math.sin(time * 7);
  ctx.strokeStyle = "#e4b04a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const dx of [-0.42, 0, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(dx * r, -r * 0.15);
    ctx.lineTo(dx * r * 0.7, -r * 0.95);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(169, 184, 255, ${pulse})`;
  ctx.beginPath();
  ctx.arc(0, -r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(215, 232, 255, 0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.9);
  ctx.lineTo(-r * 0.15, -r * 0.55);
  ctx.lineTo(r * 0.25, -r * 0.85);
  ctx.stroke();
}

function drawVenomTower(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const r = size * 0.42;
  ctx.fillStyle = "#263a24";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6d8f4a";
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.82, a, a + Math.PI * 0.85);
    ctx.stroke();
  }
  const swell = 1 + 0.08 * Math.sin(time * 3.5);
  const glow = ctx.createRadialGradient(0, -r * 0.15, 1, 0, -r * 0.15, r * 0.6);
  glow.addColorStop(0, "rgba(196, 232, 96, 0.95)");
  glow.addColorStop(1, "rgba(120, 164, 58, 0.15)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.15, r * 0.46 * swell, r * 0.55 * swell, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#9fd14a";
  ctx.beginPath();
  ctx.arc(r * 0.12, -r * 0.85, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  pos: { x: number; y: number; angle: number },
  time: number,
) {
  const spec = ENEMIES[enemy.kind];
  const bob = Math.sin(time * (spec.flying ? 6 : 9) + enemy.id) * (spec.flying ? 3.5 : 1.4);
  const lift = spec.flying ? -12 : 0;
  const size = CELL * spec.scale * (1 + enemy.hit * 1.1);
  const image = art.enemies[enemy.kind];
  ctx.save();
  ctx.translate(pos.x, pos.y + lift + bob);
  ctx.globalAlpha = enemy.hidden ? 0.3 : 1;
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, spec.flying ? 18 : 10, size * 0.26, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  if (enemy.slow < 1) {
    ctx.strokeStyle = "rgba(126, 200, 195, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.shield > 0) {
    ctx.strokeStyle = `rgba(126, 200, 195, ${0.45 + 0.35 * (enemy.shield / Math.max(1, enemy.shieldMax))})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (enemy.hidden) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(190, 160, 230, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (enemy.kind === "boss" || enemy.kind === "warden") {
    ctx.strokeStyle = enemy.kind === "warden" ? "#7ec8c3" : "#e4b04a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.46, time, time + Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.rotate(pos.angle);
  if (ready(image)) {
    ctx.drawImage(image!, -size / 2, -size / 2, size, size);
  } else if (enemy.kind === "warden") {
    drawWarden(ctx, size, time);
  } else if (enemy.kind === "shade") {
    drawShade(ctx, size, time);
  } else if (enemy.kind === "brood" || enemy.kind === "spore") {
    drawBrood(ctx, size, time, enemy.kind === "spore");
  } else {
    ctx.fillStyle = enemy.kind === "boss" ? "#e4b04a" : "#d4653a";
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Acid bubbles float upward while corrosion is active, even through stealth.
  if (enemy.dot) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#b6e05a";
    for (let i = 0; i < 3; i++) {
      const phase = (time * 1.6 + i * 0.33 + enemy.id * 0.11) % 1;
      ctx.beginPath();
      ctx.arc(
        pos.x + (i - 1) * size * 0.22,
        pos.y - size * 0.2 - phase * size * 0.6,
        2.2 + (1 - phase) * 1.6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }

  if (enemy.hp < enemy.maxHp) {
    const w = enemy.kind === "boss" || enemy.kind === "warden" ? 46 : 28;
    const x = pos.x - w / 2;
    const y = pos.y - size / 2 - 10 + lift;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y, w, 4);
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = ratio > 0.45 ? "#8fbf72" : "#d15a4a";
    ctx.fillRect(x, y, w * ratio, 4);
    if (enemy.shield > 0) {
      ctx.fillStyle = "#7ec8c3";
      ctx.fillRect(x, y - 3, w * Math.min(1, enemy.shield / Math.max(1, enemy.shieldMax)), 2);
    }
  }
}

function drawWarden(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const r = size * 0.4;
  ctx.fillStyle = "#5c3a2c";
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d9a45c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#7ec8c3";
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + time * 0.6;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.55, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e4b04a";
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawShade(ctx: CanvasRenderingContext2D, size: number, time: number) {
  const r = size * 0.36;
  ctx.strokeStyle = "#6b4a86";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (let i = -1; i <= 1; i++) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.4, 0);
      ctx.lineTo(i * r * 0.62 + side * r * 0.28, side * r * 0.7);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#31223d";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.72, r * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(196, 158, 232, ${0.6 + 0.4 * Math.sin(time * 5)})`;
  ctx.beginPath();
  ctx.arc(r * 0.34, -r * 0.12, r * 0.12, 0, Math.PI * 2);
  ctx.arc(r * 0.34, r * 0.12, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrood(ctx: CanvasRenderingContext2D, size: number, time: number, small: boolean) {
  const r = size * (small ? 0.34 : 0.4);
  const swell = 1 + 0.06 * Math.sin(time * 5);
  ctx.fillStyle = small ? "#a8c74f" : "#4d6b35";
  ctx.beginPath();
  ctx.arc(0, 0, r * swell, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = small ? "#d7e88b" : "#8fae5c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  if (!small) {
    ctx.fillStyle = "#d8e79a";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + time * 0.3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam) {
  if (beam.points.length < 2) return;
  const alpha = Math.max(0, beam.life / beam.max);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(169, 184, 255, 0.45)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(beam.points[0]!.x, beam.points[0]!.y);
  for (let i = 1; i < beam.points.length; i++) {
    const a = beam.points[i - 1]!;
    const b = beam.points[i]!;
    const jitter = 6 * (1 - alpha);
    const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * jitter;
    const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * jitter;
    ctx.lineTo(mx, my);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#eef3ff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawShot(ctx: CanvasRenderingContext2D, shot: Shot) {
  ctx.save();
  ctx.translate(shot.x, shot.y);
  ctx.rotate(Math.atan2(shot.vy, shot.vx));
  if (shot.kind === "cannon") {
    ctx.fillStyle = "#ffb15a";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4653a";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (shot.kind === "frost") {
    ctx.fillStyle = "#d7fffb";
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fill();
  } else if (shot.kind === "ballista") {
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(-12, -1.4, 22, 2.8);
    ctx.fillStyle = "#e4b04a";
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(7, 3.2);
    ctx.lineTo(7, -3.2);
    ctx.closePath();
    ctx.fill();
  } else if (shot.kind === "hive") {
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2a1c08";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (shot.kind === "venom") {
    ctx.fillStyle = "rgba(159, 209, 74, 0.35)";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b6e05a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4d6b35";
    ctx.beginPath();
    ctx.arc(1.5, -1, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e7c56a";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, 2.4);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, -2.4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
