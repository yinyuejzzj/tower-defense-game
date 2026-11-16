import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  Coins,
  Crosshair,
  FastForward,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AIM_LABEL,
  CELL,
  ENEMIES,
  MAX_RANK,
  SELL_RATIO,
  SPRITE_TOWERS,
  TOWER_ORDER,
  TOWERS,
  type EnemyKind,
  type TargetMode,
  type TowerKind,
  dmgMult,
  rateMult,
  upgradeCost,
  waveRoster,
} from "@/game/data";
import { DIFFICULTY, LEVELS, type Difficulty } from "@/game/levels";
import { isMuted, setMuted, sfx, unlockAudio } from "@/game/audio";
import { render, type View } from "@/game/render";
import { Game } from "@/game/sim";

const AIMS: TargetMode[] = ["first", "near", "strong"];

function money(n: number) {
  return Math.round(n).toString();
}

function rateLabel(n: number) {
  return n >= 10 ? n.toFixed(0) : n.toFixed(1);
}

export function Goldthorn() {
  const gameRef = useRef<Game | null>(null);
  if (!gameRef.current) gameRef.current = new Game();
  const game = gameRef.current;
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [muted, setMutedState] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layout = useRef<View>({ scale: 1, ox: 0, oy: 0, dpr: 1, cssW: 1, cssH: 1 });

  useEffect(() => {
    game.loadMeta();
    setReady(true);
    const off = game.subscribe(() => setTick((n) => n + 1));
    const onVis = () => {
      if (document.visibilityState === "visible") unlockAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    const win = window as Window & { __goldthorn?: Game };
    win.__goldthorn = game;
    return () => {
      off();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [game]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    let levelId = game.level.id;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const worldW = game.level.cols * CELL;
      const worldH = game.level.rows * CELL;
      const scale = Math.min(rect.width / worldW, rect.height / worldH);
      layout.current = {
        dpr,
        scale,
        ox: (rect.width - worldW * scale) / 2,
        oy: (rect.height - worldH * scale) / 2,
        cssW: rect.width,
        cssH: rect.height,
      };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const loop = (now: number) => {
      if (game.level.id !== levelId) {
        levelId = game.level.id;
        resize();
      }
      const dt = (now - last) / 1000;
      last = now;
      game.step(dt);
      render(ctx, game, layout.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [game]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Space") {
        event.preventDefault();
        unlockAudio();
        if (game.phase === "menu") game.restart();
        else if (game.phase === "prep") game.startWave();
      } else if (event.code === "Escape") {
        game.cancelPlace();
      } else if (event.code === "KeyP") {
        game.togglePause();
      } else if (event.code === "KeyM") {
        unlockAudio();
        const next = !isMuted();
        setMuted(next);
        setMutedState(next);
      } else if (event.code === "KeyR") {
        if (game.phase === "prep" || game.phase === "combat") game.restart();
      } else if (event.code.startsWith("Digit")) {
        const index = Number(event.code.slice(5));
        const kind = TOWER_ORDER[index - 1];
        if (kind) game.pickTower(kind);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const view = layout.current;
    return {
      x: (event.clientX - rect.left - view.ox) / view.scale,
      y: (event.clientY - rect.top - view.oy) / view.scale,
    };
  };

  const overlay = game.phase === "menu" || game.phase === "won" || game.phase === "lost";
  const roster = waveRoster(Math.min(game.wave, game.waveCount - 1), game.level.waves);
  const selected = game.selected;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          金棘防线
          <small>
            {game.level.name} · {DIFFICULTY[game.difficulty].label} · 撑过 {game.waveCount} 波
          </small>
        </div>
        <div className="stats">
          <div className={game.lives <= 5 ? "stat is-low" : "stat"}>
            <Heart />
            <span>生命</span>
            <strong>{game.lives}</strong>
          </div>
          <div className="stat">
            <Coins />
            <span>金币</span>
            <strong>{game.gold}</strong>
          </div>
          <div className="stat">
            <Crosshair />
            <span>波次</span>
            <strong>
              {Math.min(game.wave + 1, game.waveCount)}/{game.waveCount}
            </strong>
          </div>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="ghost-btn"
            aria-label="重新开始本局"
            title="重新开始本局（R）"
            onClick={() => {
              unlockAudio();
              game.restart();
            }}
          >
            <RotateCcw />
            重开本局
          </button>
          <button
            type="button"
            className="ghost-btn"
            aria-label={game.paused ? "继续" : "暂停"}
            aria-pressed={game.paused}
            onClick={() => game.togglePause()}
          >
            {game.paused ? <Play /> : <Pause />}
            {game.paused ? "继续" : "暂停"}
          </button>
          <button
            type="button"
            className="ghost-btn"
            aria-label={game.speed === 2 ? "两倍速" : "一倍速"}
            aria-pressed={game.speed === 2}
            onClick={() => game.toggleSpeed()}
          >
            <FastForward />
            {game.speed === 2 ? "两倍" : "一倍"}
          </button>
          <button
            type="button"
            className="ghost-btn"
            aria-label={muted ? "开声" : "静音"}
            aria-pressed={muted}
            onClick={() => {
              unlockAudio();
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
            {muted ? "开声" : "静音"}
          </button>
        </div>
      </header>

      <div className="stage" inert={overlay ? true : undefined}>
        <div className="board" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => {
              unlockAudio();
              event.currentTarget.setPointerCapture(event.pointerId);
              const p = point(event);
              game.pointer(p.x, p.y, "down");
            }}
            onPointerMove={(event) => {
              const p = point(event);
              game.pointer(p.x, p.y, "move");
            }}
            onPointerLeave={() => game.clearHover()}
          />
          {game.toast ? (
            <div className="toast" role="status">
              {game.toast}
            </div>
          ) : null}
        </div>

        <aside className="dock">
          <div className="wave-row">
            <div>
              <p className="preview">
                {game.phase === "combat" ? (
                  <span>场上与未出场 {game.remaining}</span>
                ) : (
                  <>
                    下一波
                    {[...roster.entries()].map(([kind, count]) => (
                      <span key={kind}>
                        {ENEMIES[kind as EnemyKind].name} ×{count}
                      </span>
                    ))}
                  </>
                )}
              </p>
              {game.paused ? <p className="pause-pill">已暂停，仍可建塔和升级</p> : null}
            </div>
            <button
              type="button"
              className="primary"
              disabled={game.phase !== "prep"}
              onClick={() => {
                unlockAudio();
                game.startWave();
              }}
            >
              <Play />
              {game.phase === "combat" ? "交战中" : `开始第 ${Math.min(game.wave + 1, game.waveCount)} 波`}
            </button>
          </div>

          <div className="shop" role="listbox" aria-label="防御塔">
            {TOWER_ORDER.map((kind) => {
              const def = TOWERS[kind];
              const poor = game.gold < def.cost;
              return (
                <button
                  key={kind}
                  type="button"
                  className={game.placing === kind ? "card is-on" : poor ? "card is-poor" : "card"}
                  aria-pressed={game.placing === kind}
                  onClick={() => {
                    unlockAudio();
                    game.pickTower(kind);
                  }}
                >
                  <TowerGlyph kind={kind} />
                  <span className="card-name">{def.name}</span>
                  <span className="card-cost">{def.cost} 金</span>
                  <span className="card-blurb">
                    射程 {def.range.toFixed(1)} · {def.blurb}
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <Inspector game={game} />
          ) : (
            <p className="hint">
              {game.towers.length === 0
                ? "先点一种塔，再点亮着的草地。土路上不能建造。击杀掉金币，用来强化伤害或射速。"
                : "点已放置的塔，可升级伤害、射速，或改瞄准。出售返还六成花费。"}
            </p>
          )}
          <p className="hints">键盘：1–7 选塔，空格出波，P 暂停，Esc 取消，M 静音，R 重开本局</p>
        </aside>
      </div>

      {game.phase === "menu" ? (
        <div className="veil">
          <div className="panel menu-panel">
            <h1>金棘防线</h1>
            <p>
              怪物沿荆棘土路涌向金门。把塔落在草地两侧，用击杀掉落的金币走两条升级路：伤害，或射速。漏怪扣生命，生命归零即失守。
            </p>

            <div className="pick-label">选择防线</div>
            <div className="level-pick" role="radiogroup" aria-label="关卡">
              {LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  className={game.level.id === level.id ? "level-card is-on" : "level-card"}
                  aria-pressed={game.level.id === level.id}
                  onClick={() => game.setLevel(level.id)}
                >
                  <strong>{level.name}</strong>
                  <span>{level.blurb}</span>
                  <em>
                    {level.waves.length} 波 · {level.cols}×{level.rows} · {level.paths.length} 个出生点
                  </em>
                </button>
              ))}
            </div>

            <div className="pick-label">难度</div>
            <div className="diff-row" role="radiogroup" aria-label="难度">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={game.difficulty === key ? "diff-btn is-on" : "diff-btn"}
                  aria-pressed={game.difficulty === key}
                  onClick={() => game.setDifficulty(key)}
                >
                  <strong>{DIFFICULTY[key].label}</strong>
                  <span>{DIFFICULTY[key].note}</span>
                </button>
              ))}
            </div>

            <details className="codex">
              <summary>敌情与克制 · 点开查看</summary>
              <div className="codex-body">
                <p className="codex-lead">
                  三种新单位各有独立行为，靠对应塔种破解；原版五种敌人的数值与行为完全未改。
                </p>
                {(Object.keys(ENEMIES) as EnemyKind[]).map((kind) => {
                  const def = ENEMIES[kind];
                  return (
                    <div className="codex-row" key={kind}>
                      <strong>{def.name}</strong>
                      <span>{def.note}</span>
                      <p>{def.counter ?? "常规单位：按射程与火力覆盖即可。"}</p>
                    </div>
                  );
                })}
                <div className="codex-lead">新增武器</div>
                {(["arc", "venom"] as TowerKind[]).map((kind) => (
                  <div className="codex-row" key={kind}>
                    <strong>{TOWERS[kind].name}</strong>
                    <span>{TOWERS[kind].cost} 金 · 射程 {TOWERS[kind].range.toFixed(2)}</span>
                    <p>{TOWERS[kind].note}</p>
                  </div>
                ))}
              </div>
            </details>

            {ready && game.bestCleared > 0 ? (
              <p className="record">
                本防线最远纪录：清过第 {game.bestCleared} 波
                {game.wins > 0 ? ` · 守成 ${game.wins} 次` : ""}
              </p>
            ) : null}
            <div className="veil-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  unlockAudio();
                  sfx.place();
                  game.restart();
                }}
              >
                <Play />
                进入防线
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {game.phase === "won" || game.phase === "lost" ? (
        <div className="veil">
          <div className="panel">
            <h2>{game.phase === "won" ? "棘路已静" : "金门失守"}</h2>
            <p>
              {game.phase === "won"
                ? `${game.waveCount} 波尽数挡下。金门还在，荆棘仍守着这条路。`
                : `防线在第 ${game.wave + 1} 波被撕开。`}
            </p>
            <div className="end-stats">
              <div>
                <span>击杀</span>
                <strong>{game.kills}</strong>
              </div>
              <div>
                <span>获得金币</span>
                <strong>{game.earned}</strong>
              </div>
              <div>
                <span>漏掉生命</span>
                <strong>{game.leaked}</strong>
              </div>
              <div>
                <span>清过波次</span>
                <strong>{game.bestCleared}</strong>
              </div>
            </div>
            <div className="veil-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  unlockAudio();
                  game.restart();
                }}
              >
                <RotateCcw />
                重新开始
              </button>
              <button type="button" className="ghost-btn" onClick={() => game.toMenu()}>
                返回标题
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Procedural towers have no PNG; draw a matching inline glyph instead of a 404. */
function TowerGlyph({ kind }: { kind: TowerKind }) {
  if (SPRITE_TOWERS.includes(kind)) return <img src={`/art/${kind}.png`} alt="" />;
  if (kind === "arc") {
    return (
      <svg className="glyph" viewBox="0 0 48 48" aria-hidden="true">
        <polygon points="24,4 41,14 41,34 24,44 7,34 7,14" fill="#20332f" stroke="#7ec8c3" strokeWidth="2" />
        <path d="M15 30 L13 12 M24 30 L24 9 M33 30 L35 12" stroke="#e4b04a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="27" r="6" fill="#a9b8ff" />
        <path d="M13 12 L20 20 L28 13 L35 12" fill="none" stroke="#eef3ff" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg className="glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="#263a24" />
      <path d="M6 24 A18 18 0 0 1 42 24 M42 24 A18 18 0 0 1 6 24" fill="none" stroke="#6d8f4a" strokeWidth="3" />
      <ellipse cx="24" cy="21" rx="10" ry="12" fill="#9fd14a" />
      <ellipse cx="24" cy="19" rx="6" ry="7" fill="#c8e860" opacity="0.8" />
      <circle cx="30" cy="8" r="3" fill="#b6e05a" />
    </svg>
  );
}

function Inspector({ game }: { game: Game }) {
  const tower = game.selected;
  if (!tower) return null;
  const def = TOWERS[tower.kind];
  const dmgNow = def.damage * dmgMult(tower.dmg);
  const rateNow = def.rate * rateMult(tower.rate);
  const dmgCost = tower.dmg < MAX_RANK ? upgradeCost(def.cost, tower.dmg, "dmg") : 0;
  const rateCost = tower.rate < MAX_RANK ? upgradeCost(def.cost, tower.rate, "rate") : 0;
  const refund = Math.floor(tower.spent * SELL_RATIO);

  return (
    <section className="inspector">
      <h2>{def.name}</h2>
      <p>
        射程 {def.range.toFixed(1)} 格
        {def.pierce ? " · 无视护甲" : ""}
        {def.splash > 0 ? " · 溅射" : ""}
        {def.slow < 1 ? " · 减速" : ""}
        {" · "}
        瞄准{AIM_LABEL[tower.aim]}
      </p>
      {def.note ? <p className="inspector-note">{def.note}</p> : null}
      <div className="statline">
        <span>伤害 {rateLabel(dmgNow)}</span>
        <span className="ranks" aria-label={`伤害等级 ${tower.dmg}`}>
          {[0, 1, 2].map((pip) => (
            <i key={pip} className={pip < tower.dmg ? "pip on" : "pip"} />
          ))}
        </span>
      </div>
      <div className="statline">
        <span>射速 {rateLabel(rateNow)} /秒</span>
        <span className="ranks" aria-label={`射速等级 ${tower.rate}`}>
          {[0, 1, 2].map((pip) => (
            <i key={pip} className={pip < tower.rate ? "pip on" : "pip"} />
          ))}
        </span>
      </div>
      <div className="upgrade-row">
        <button
          type="button"
          className="choice"
          disabled={tower.dmg >= MAX_RANK || game.gold < dmgCost}
          onClick={() => game.upgrade("dmg")}
        >
          {tower.dmg >= MAX_RANK ? "伤害已满" : `强化伤害 ${money(dmgCost)} 金`}
        </button>
        <button
          type="button"
          className="choice"
          disabled={tower.rate >= MAX_RANK || game.gold < rateCost}
          onClick={() => game.upgrade("rate")}
        >
          {tower.rate >= MAX_RANK ? "射速已满" : `强化射速 ${money(rateCost)} 金`}
        </button>
      </div>
      <div className="aim-row" role="group" aria-label="瞄准方式">
        {AIMS.map((mode) => (
          <button
            key={mode}
            type="button"
            className="choice"
            aria-pressed={tower.aim === mode}
            onClick={() => game.setAim(mode)}
          >
            {AIM_LABEL[mode]}
          </button>
        ))}
      </div>
      <button type="button" className="sell" onClick={() => game.sell()}>
        出售 · 返还 {refund} 金
      </button>
    </section>
  );
}
