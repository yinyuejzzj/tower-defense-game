type Osc = OscillatorType;

let ctx: AudioContext | null = null;
let muted = false;
let lastShoot = 0;

export function isMuted() {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: Osc, gain: number, slide = 0) {
  if (!ctx || muted || gain <= 0) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide !== 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), now + dur);
  }
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export const sfx = {
  shoot(kind: string) {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastShoot < 0.045) return;
    lastShoot = now;
    if (kind === "bow") tone(640, 0.06, "triangle", 0.035);
    else if (kind === "hive") tone(980, 0.04, "sine", 0.02);
    else if (kind === "frost") tone(820, 0.09, "sine", 0.04, 180);
    else if (kind === "cannon") tone(150, 0.14, "square", 0.04, -70);
    else if (kind === "ballista") tone(210, 0.1, "sawtooth", 0.03, -40);
    else if (kind === "arc") {
      // Bright descending crackle: instant chain lightning, no projectile whoosh.
      tone(1320, 0.055, "sawtooth", 0.032, -980);
      tone(2460, 0.035, "square", 0.016, -1500);
      tone(660, 0.07, "triangle", 0.02, -420);
    } else if (kind === "venom") {
      // Wet low bubble rising into a hiss: slow corrosive glob.
      tone(190, 0.13, "sine", 0.04, 110);
      tone(96, 0.17, "triangle", 0.026, -38);
      setTimeout(() => tone(430, 0.06, "sawtooth", 0.014, -180), 55);
    }
  },
  arcHit() {
    tone(1740, 0.04, "square", 0.018, -1200);
  },
  venomHit() {
    tone(260, 0.11, "sine", 0.026, 150);
    tone(130, 0.13, "triangle", 0.018, -40);
  },
  place() {
    tone(220, 0.07, "triangle", 0.05);
    tone(330, 0.09, "triangle", 0.04);
  },
  upgrade() {
    tone(520, 0.08, "triangle", 0.05, 180);
  },
  sell() {
    tone(360, 0.1, "sine", 0.04, -180);
  },
  kill() {
    tone(880, 0.07, "sine", 0.04, 240);
  },
  leak() {
    tone(110, 0.22, "square", 0.05, -50);
  },
  wave() {
    tone(392, 0.1, "triangle", 0.04);
    setTimeout(() => tone(523, 0.12, "triangle", 0.04), 90);
  },
  clear() {
    tone(660, 0.1, "sine", 0.045, 80);
  },
  win() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.16, "triangle", 0.05), i * 110);
    });
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.18, "sine", 0.05), i * 130);
    });
  },
};
