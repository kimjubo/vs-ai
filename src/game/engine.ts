import playerUrl from "../../public/sprites/player.png";
import droneUrl from "../../public/sprites/drone.png";
import turretUrl from "../../public/sprites/turret.png";
import swooperUrl from "../../public/sprites/swooper.png";
import bossUrl from "../../public/sprites/boss.png";
import musicUrl from "../../public/audio/metal.wav?url";

/**
 * VS.AI — vertical shmup.
 * Screen-space movement (not chase-cam yaw): A/← moves left, D/→ moves right,
 * W/↑ moves up the playfield, S/↓ moves down. Ship nose stays toward the top.
 *
 * Weapon tiers from power-ups: 0 one stream, 1 three streams, 2 four streams + homing missiles.
 */

export type Phase = "title" | "play" | "pause" | "over" | "win";

export type Hud = {
  phase: Phase;
  score: number;
  best: number;
  lives: number;
  bombs: number;
  bossHp: number;
  bossName: string;
  sector: string;
  warn: string;
  focus: boolean;
  chain: number;
  power: number;
  stage: number;
  rank: string;
};

export const INITIAL_HUD: Hud = {
  phase: "title",
  score: 0,
  best: 0,
  lives: 4,
  bombs: 3,
  bossHp: -1,
  bossName: "",
  sector: "데이터 사막",
  warn: "",
  focus: false,
  chain: 0,
  power: 0,
  stage: 1,
  rank: "",
};

const W = 540;
const H = 960;
const BG_FADE = 1.2;
const BEST_KEY = "vsai.best.v1";
const MUTE_KEY = "vsai.mute.v1";

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}

type Kind = "drone" | "turret" | "swooper" | "mite";

type Bullet = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 0 | 1 | 2;
  grazed: boolean;
  homing: boolean;
  age: number;
};

type Enemy = {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  originX: number;
  vx: number;
  vy: number;
  hp: number;
  max: number;
  r: number;
  t: number;
  fire: number;
  phase: number;
  score: number;
  drop: "power" | "bomb" | "none";
  shot: boolean;
};

type Boss = {
  alive: boolean;
  x: number;
  y: number;
  hp: number;
  max: number;
  t: number;
  fire: number;
  hit: number;
  flag: number;
  form: number;
  hitR: number;
  bodyR: number;
};

type Bit = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
};

type Pickup = {
  alive: boolean;
  x: number;
  y: number;
  kind: "power" | "bomb";
  life: number;
};

type Spawn = { t: number; kind: Kind; x: number; dir: number };

type StageDef = {
  name: string;
  boss: string;
  hue: number;
  bossAt: number;
  hp: number;
  form: number;
  waves: Spawn[];
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function loadImage(src: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  return img;
}

function rankOf(score: number) {
  if (score >= 140000) return "S";
  if (score >= 90000) return "A";
  if (score >= 55000) return "B";
  if (score >= 28000) return "C";
  return "D";
}

function makeStages(): StageDef[] {
  const waves = (fill: (push: (t: number, kind: Kind, x: number, dir?: number) => void) => void) => {
    const list: Spawn[] = [];
    fill((t, kind, x, dir = 0) => list.push({ t, kind, x, dir }));
    return list;
  };
  const raw: StageDef[] = [
    {
      name: "데이터 사막",
      boss: "샌드 크롤러",
      hue: 28,
      bossAt: 12,
      hp: 150,
      form: 0,
      waves: waves((push) => {
        for (let i = 0; i < 6; i++) push(0.6 + i * 0.42, "drone", 90 + (i % 3) * 150);
        push(4.2, "turret", 150);
        push(4.8, "turret", 390);
        for (let i = 0; i < 5; i++) push(7.4 + i * 0.32, "mite", 70 + i * 90);
        for (let i = 0; i < 3; i++) push(9.6 + i * 0.55, "drone", 140 + i * 120);
      }),
    },
    {
      name: "해저 케이블",
      boss: "케이블 리바이어던",
      hue: 196,
      bossAt: 12.5,
      hp: 210,
      form: 1,
      waves: waves((push) => {
        for (let i = 0; i < 4; i++) push(0.7 + i * 0.9, "swooper", i % 2 === 0 ? -36 : W + 36, i % 2 === 0 ? 1 : -1);
        for (let i = 0; i < 6; i++) push(4.2 + i * 0.28, "mite", 60 + (i % 6) * 75);
        push(7.2, "drone", 180);
        push(7.5, "drone", 360);
        for (let i = 0; i < 3; i++) push(9.2 + i * 0.8, "swooper", i % 2 ? -36 : W + 36, i % 2 ? 1 : -1);
      }),
    },
    {
      name: "메가시티 그리드",
      boss: "시즈 스파이더",
      hue: 268,
      bossAt: 13,
      hp: 280,
      form: 2,
      waves: waves((push) => {
        for (let i = 0; i < 5; i++) push(0.6 + i * 0.4, "drone", 80 + i * 90);
        push(3.6, "turret", 270);
        for (let i = 0; i < 4; i++) push(5.4 + i * 0.85, "swooper", i % 2 === 0 ? -36 : W + 36, i % 2 === 0 ? 1 : -1);
        push(9.2, "turret", 140);
        push(9.6, "turret", 400);
        for (let i = 0; i < 4; i++) push(11 + i * 0.3, "mite", 100 + i * 90);
      }),
    },
    {
      name: "얼음 위성",
      boss: "글래시어 맨티스",
      hue: 202,
      bossAt: 12.5,
      hp: 340,
      form: 3,
      waves: waves((push) => {
        for (let i = 0; i < 8; i++) push(0.5 + i * 0.28, "mite", 50 + (i % 4) * 120);
        for (let i = 0; i < 3; i++) push(4.2 + i, "swooper", i % 2 === 0 ? -36 : W + 36, i % 2 === 0 ? 1 : -1);
        push(7.6, "turret", 180);
        push(8.1, "turret", 360);
        for (let i = 0; i < 5; i++) push(10 + i * 0.35, "drone", 90 + (i % 5) * 80);
      }),
    },
    {
      name: "클라우드 레이어",
      boss: "캐노피 미라주",
      hue: 152,
      bossAt: 13,
      hp: 400,
      form: 4,
      waves: waves((push) => {
        for (let i = 0; i < 5; i++) push(0.6 + i * 0.85, "swooper", i % 2 === 0 ? -36 : W + 36, i % 2 === 0 ? 1 : -1);
        for (let i = 0; i < 6; i++) push(5.2 + i * 0.3, "drone", 70 + (i % 3) * 160);
        push(8.4, "turret", 270);
        for (let i = 0; i < 4; i++) push(10.2 + i * 0.45, "mite", 80 + i * 100);
      }),
    },
    {
      name: "카오스 코어",
      boss: "카오스 퀸",
      hue: 282,
      bossAt: 13.5,
      hp: 760,
      form: 5,
      waves: waves((push) => {
        for (let i = 0; i < 6; i++) push(0.5 + i * 0.35, i % 2 ? "drone" : "mite", 70 + (i % 5) * 85);
        push(3.4, "turret", 150);
        push(3.8, "turret", 390);
        for (let i = 0; i < 4; i++) push(6.2 + i * 0.75, "swooper", i % 2 === 0 ? -36 : W + 36, i % 2 === 0 ? 1 : -1);
        push(9.8, "turret", 270);
        for (let i = 0; i < 6; i++) push(11.2 + i * 0.28, "drone", 60 + (i % 6) * 75);
      }),
    },
  ];
  return raw.map((st) => {
    const waves = densify(st.waves);
    return {
      ...st,
      bossAt: st.bossAt * 2,
      waves: thicken([...waves, ...waves.map((w) => ({ ...w, t: w.t + st.bossAt }))]),
    };
  });
}

function densify(waves: Spawn[]): Spawn[] {
  const extra: Spawn[] = [];
  waves.forEach((w, i) => {
    if (i % 10 >= 3) return;
    const edge = w.x < 0 || w.x > W;
    extra.push({
      ...w,
      t: Math.round((w.t + 0.42) * 100) / 100,
      x: edge ? w.x : clamp(w.x + (i % 2 ? 72 : -72), 48, W - 48),
    });
  });
  return [...waves, ...extra];
}

function thicken(waves: Spawn[]): Spawn[] {
  const extra: Spawn[] = [];
  for (let i = 0; i < waves.length; i += 5) {
    const w = waves[i];
    const edge = w.x < 0 || w.x > W;
    extra.push({
      ...w,
      t: Math.round((w.t + (edge ? 0.55 : 0.22)) * 100) / 100,
      x: edge ? w.x : clamp(w.x + (i % 2 ? 70 : -70), 48, W - 48),
    });
  }
  return [...waves, ...extra].sort((a, b) => a.t - b.t || a.x - b.x);
}

const STAGES = makeStages();

export class Shmup {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = true;

  private phase: Phase = "title";
  private time = 0;
  private score = 0;
  private best = 0;
  private lives = 4;
  private bombs = 3;
  private power = 0;
  private stage = 0;
  private bgFade = 0;
  private bgFrom = 0;
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgCtx: CanvasRenderingContext2D | null = null;
  private clearing = 0;
  private missileCd = 0;
  private gifted = false;
  private banner = "";
  private bannerT = 0;
  private chain = 0;
  private chainTimer = 0;
  private inv = 0;
  private fireCd = 0;
  private bombLock = 0;
  private finale = 0;
  private scroll = 0;
  private shake = 0;
  private flash = 0;
  private focus = false;
  private focusHeld = false;
  private warn = "";
  private sector = STAGES[0].name;
  private spawnCursor = 0;
  private droneDrops = 0;
  private bombSlots = new Set<number>();
  private shotFlip = 0;

  private player = { x: W / 2, y: H - 150 };
  private lastSpeed = 0;
  private bank = 0;
  private dragging = false;
  private pointerId: number | null = null;
  private grabX = 0;
  private grabY = 0;

  private held = new Set<string>();
  private pressed = new Set<string>();
  private steer = 0;
  private steerActive = false;

  private pBullets: Bullet[] = [];
  private eBullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private parts: Bit[] = [];
  private picks: Pickup[] = [];
  private partCursor = 0;
  private boss: Boss | null = null;

  private reduceMotion = false;
  private muted = false;
  private audio: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBuf: AudioBuffer | null = null;
  private musicSrc: AudioBufferSourceNode | null = null;
  private musicBus: GainNode | null = null;
  private musicLoading = false;

  private imgs = {
    player: loadImage(playerUrl),
    drone: loadImage(droneUrl),
    turret: loadImage(turretUrl),
    swooper: loadImage(swooperUrl),
    boss: loadImage(bossUrl),
  };

  private lastSig = "";
  private onHud: (h: Hud) => void;

  private onKeyDown = (e: KeyboardEvent) => {
    const block = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code);
    if (block) e.preventDefault();
    if (e.repeat) return;
    this.held.add(e.code);
    this.pressed.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private onBlur = () => {
    this.held.clear();
    this.pressed.clear();
    this.dragging = false;
    this.pointerId = null;
    this.focusHeld = false;
  };

  private onHide = () => {
    if (document.hidden && this.phase === "play") {
      this.phase = "pause";
      this.emit(true);
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.phase !== "play") return;
    if (e.button !== 0) return;
    const p = this.toLogical(e);
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.grabX = this.player.x - p.x;
    this.grabY = this.player.y - p.y;
    this.ctx.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const p = this.toLogical(e);
    this.player.x = clamp(p.x + this.grabX, 28, W - 28);
    this.player.y = clamp(p.y + this.grabY, 48, H - 36);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
  };

  constructor(canvas: HTMLCanvasElement, onHud: (h: Hud) => void) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
    this.onHud = onHud;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* private mode */
    }
    this.pool();
    this.resize();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onHide);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    this.attachProbe();
    this.emit(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private pool() {
    const bullet = (): Bullet => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 4, kind: 1, grazed: false, homing: false, age: 0,
    });
    this.pBullets = Array.from({ length: 96 }, bullet);
    this.eBullets = Array.from({ length: 360 }, bullet);
    this.enemies = Array.from({ length: 56 }, () => ({
      alive: false, kind: "drone" as Kind, x: 0, y: 0, originX: 0, vx: 0, vy: 0,
      hp: 1, max: 1, r: 16, t: 0, fire: 0, phase: 0, score: 100, drop: "none" as const, shot: false,
    }));
    this.parts = Array.from({ length: 220 }, () => ({
      alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff",
    }));
    this.picks = Array.from({ length: 12 }, () => ({
      alive: false, x: 0, y: 0, kind: "power" as const, life: 0,
    }));
  }

  private attachProbe() {
    window.__controlsTest = {
      getYaw: () => -Math.PI / 2,
      getSpeed: () => this.lastSpeed,
      getX: () => this.player.x,
      getY: () => this.player.y,
      setSteer: (v: number) => {
        this.steer = clamp(v, -1, 1);
        this.steerActive = true;
      },
      setKeys: (codes: string[]) => {
        this.held.clear();
        for (const c of codes) this.held.add(c);
      },
    };
  }

  private resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = this.ctx.canvas;
    canvas.width = Math.round(W * this.dpr);
    canvas.height = Math.round(H * this.dpr);
  }

  private toLogical(e: PointerEvent) {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onHide);
    const canvas = this.ctx.canvas;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerUp);
    if (window.__controlsTest) delete window.__controlsTest;
    void this.audio?.close();
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.22;
    return this.muted;
  }

  setFocusHeld(v: boolean) {
    this.focusHeld = v;
  }

  start() {
    this.unlockAudio();
    this.phase = "play";
    this.time = 0;
    this.score = 0;
    this.lives = 4;
    this.bombs = 3;
    this.power = 0;
    this.stage = 0;
    this.bgFade = 0;
    this.clearing = 0;
    this.missileCd = 0;
    this.gifted = false;
    this.banner = "";
    this.bannerT = 0;
    this.chain = 0;
    this.chainTimer = 0;
    this.inv = 1.4;
    this.fireCd = 0;
    this.bombLock = 0;
    this.finale = 0;
    this.spawnCursor = 0;
    this.droneDrops = 0;
    this.boss = null;
    this.warn = "";
    this.sector = STAGES[0].name;
    this.rollBombs();
    this.player.x = W / 2;
    this.player.y = H - 170;
    this.lastSpeed = 0;
    for (const b of this.pBullets) b.alive = false;
    for (const b of this.eBullets) b.alive = false;
    for (const e of this.enemies) e.alive = false;
    for (const p of this.parts) p.alive = false;
    for (const p of this.picks) p.alive = false;
    this.blip(660, 0.08, 0.04);
    this.emit(true);
  }

  backToTitle() {
    this.phase = "title";
    this.boss = null;
    this.warn = "";
    this.clearing = 0;
    this.held.clear();
    this.emit(true);
  }

  togglePause() {
    if (this.phase === "play") this.phase = "pause";
    else if (this.phase === "pause") this.phase = "play";
    this.emit(true);
  }

  tryBomb() {
    if (this.phase !== "play" || this.bombLock > 0 || this.bombs <= 0 || this.finale > 0) return;
    this.bombs -= 1;
    this.bombLock = 0.4;
    this.flash = 0.45;
    this.shake = Math.max(this.shake, 12);
    this.sweep(180, 40);
    for (const b of this.eBullets) b.alive = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hp -= 8;
      if (e.hp <= 0) this.killEnemy(e);
    }
    if (this.boss?.alive) {
      this.boss.hp = Math.max(0, this.boss.hp - 70);
      this.boss.hit = 0.15;
      if (this.boss.hp <= 0) this.defeatBoss();
    }
    this.burst(this.player.x, this.player.y, 40, "#e4b15a", 420);
    this.burst(this.player.x, this.player.y, 24, "#3ee0ff", 220);
    this.emit(true);
  }

  private unlockAudio() {
    if (!this.audio) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.22;
      master.connect(ctx.destination);
      this.audio = ctx;
      this.master = master;
    }
    if (this.audio.state === "suspended") void this.audio.resume();
    this.loadMusic();
  }

  private loadMusic() {
    if (this.musicLoading || this.musicBuf || !this.audio) return;
    this.musicLoading = true;
    const ctx = this.audio;
    fetch(musicUrl)
      .then((res) => res.arrayBuffer())
      .then((raw) => ctx.decodeAudioData(raw))
      .then((buf) => {
        this.musicBuf = buf;
        this.syncMusic();
      })
      .catch(() => {
        this.musicLoading = false;
      });
  }

  private syncMusic() {
    if (!this.audio || !this.master || !this.musicBuf) return;
    if (!this.musicSrc) {
      const bus = this.audio.createGain();
      bus.gain.value = 0;
      bus.connect(this.master);
      this.musicBus = bus;
      const src = this.audio.createBufferSource();
      src.buffer = this.musicBuf;
      src.loop = true;
      src.connect(bus);
      src.start();
      this.musicSrc = src;
    }
    this.musicBus?.gain.setTargetAtTime(this.phase === "play" ? 0.85 : 0, this.audio.currentTime, 0.08);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
    if (!this.audio || !this.master || this.muted) return;
    const t = this.audio.currentTime;
    const osc = this.audio.createOscillator();
    const g = this.audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number) {
    if (!this.audio || !this.master || this.muted) return;
    const t = this.audio.currentTime;
    const frames = Math.floor(this.audio.sampleRate * dur);
    const buf = this.audio.createBuffer(1, frames, this.audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.audio.createBufferSource();
    src.buffer = buf;
    const filter = this.audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const g = this.audio.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  private blip(freq: number, dur: number, gain: number) {
    this.tone(freq, dur, "square", gain);
  }

  private sweep(from: number, to: number) {
    this.tone(from, 0.35, "sawtooth", 0.05, to - from);
  }

  private rollBombs() {
    const n = STAGES[this.stage].waves.length;
    const bag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = bag[i];
      bag[i] = bag[j];
      bag[j] = swap;
    }
    this.bombSlots = new Set(bag.slice(0, Math.min(2, n)));
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    const step = 1 / 60;
    let guard = 0;
    while (this.acc >= step && guard < 5) {
      this.update(step);
      this.acc -= step;
      guard += 1;
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private handlePresses() {
    if (this.phase === "title" && (this.pressed.has("Enter") || this.pressed.has("Space"))) {
      this.start();
    } else if (
      (this.pressed.has("KeyP") || this.pressed.has("Escape")) &&
      (this.phase === "play" || this.phase === "pause")
    ) {
      this.togglePause();
    } else if (this.phase === "play" && (this.pressed.has("Space") || this.pressed.has("KeyZ") || this.pressed.has("KeyX"))) {
      this.tryBomb();
    }
    this.pressed.clear();
  }

  private update(dt: number) {
    this.handlePresses();
    this.bombLock = Math.max(0, this.bombLock - dt);
    this.syncMusic();
    if (this.phase !== "play") return;
    if (this.bgFade > 0) this.bgFade = Math.max(0, this.bgFade - dt);
    this.focus = this.focusHeld || this.held.has("ShiftLeft") || this.held.has("ShiftRight");
    if (this.bannerT > 0) this.bannerT -= dt;

    let mx = 0;
    let my = 0;
    if (this.held.has("KeyA") || this.held.has("ArrowLeft")) mx -= 1;
    if (this.held.has("KeyD") || this.held.has("ArrowRight")) mx += 1;
    if (this.held.has("KeyW") || this.held.has("ArrowUp")) my -= 1;
    if (this.held.has("KeyS") || this.held.has("ArrowDown")) my += 1;
    if (this.steerActive) mx -= this.steer;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    const speed = this.focus ? 200 : 440;
    const prevX = this.player.x;
    if (!this.dragging) {
      this.player.x = clamp(this.player.x + mx * speed * dt, 28, W - 28);
      this.player.y = clamp(this.player.y + my * speed * dt, 48, H - 36);
    }
    this.lastSpeed = this.dragging ? Math.abs(this.player.x - prevX) / Math.max(dt, 0.001) : Math.hypot(mx, my) * speed;
    const tilt = clamp((this.player.x - prevX) / (440 * Math.max(dt, 0.001)), -1, 1);
    this.bank += (tilt * 0.38 - this.bank) * Math.min(1, dt * 12);

    if (this.inv > 0) this.inv -= dt;
    if (this.finale > 0) {
      this.finale -= dt;
      if (Math.random() < 0.4 && this.boss) {
        this.burst(this.boss.x + (Math.random() - 0.5) * 160, this.boss.y + (Math.random() - 0.5) * 80, 6, "#3ee0ff", 260);
      }
      if (this.finale <= 0) {
        this.phase = "win";
        this.commitScore();
        this.blip(523, 0.18, 0.05);
        this.emit(true);
        return;
      }
    }

    if (this.clearing > 0) {
      this.clearing -= dt;
      this.warn = "스테이지 돌파";
      if (this.clearing <= 0) {
        this.beginBgFade(this.stage);
        this.stage += 1;
        this.time = 0;
        this.spawnCursor = 0;
        this.gifted = false;
        this.boss = null;
        this.warn = "";
        this.sector = STAGES[this.stage].name;
        this.inv = Math.max(this.inv, 1.1);
        this.rollBombs();
        this.emit(true);
      }
    } else {
      this.time += dt;
      this.stageLabel();
      this.spawnDirector();
    }

    this.firePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updatePicks(dt);
    this.updateParts(dt);
    this.collide();
    if (this.chainTimer > 0) {
      this.chainTimer -= dt;
      if (this.chainTimer <= 0) this.chain = 0;
    }
    this.emit(false);
  }

  private stageLabel() {
    const st = STAGES[this.stage];
    this.sector = st.name;
    if (this.bannerT > 0) this.warn = this.banner;
    else if (!this.boss && this.finale <= 0 && this.time >= st.bossAt - 1.7 && this.time < st.bossAt) {
      this.warn = `${st.boss} 접근`;
    } else if (!this.boss) this.warn = "";
  }

  private spawnDirector() {
    if (this.finale > 0) return;
    const st = STAGES[this.stage];
    while (this.spawnCursor < st.waves.length && st.waves[this.spawnCursor].t <= this.time && !this.boss) {
      this.spawn(st.waves[this.spawnCursor], this.spawnCursor);
      this.spawnCursor += 1;
    }
    if (!this.gifted && this.time >= 1.4 && this.power < 2) {
      this.gifted = true;
      this.drop(W / 2, -16, "power");
    }
    if (!this.boss && this.time >= st.bossAt) this.spawnBoss();
  }

  private spawn(s: Spawn, index: number) {
    const e = this.enemies.find((x) => !x.alive);
    if (!e) return;
    const wantPower = this.power < 2;
    const bomb = this.bombSlots.has(index);
    e.alive = true;
    e.kind = s.kind;
    e.x = s.x;
    e.originX = s.x;
    e.y = s.kind === "swooper" ? 150 + (s.t % 5) * 28 : -40;
    e.t = 0;
    e.fire = 0.8;
    e.phase = s.t;
    e.shot = false;
    e.vx = s.kind === "swooper" ? s.dir * 210 : 0;
    e.vy = s.kind === "mite" ? 360 : s.kind === "drone" ? 155 : 0;
    if (s.kind === "drone") {
      e.hp = e.max = 2;
      e.r = 16;
      e.score = 200;
      this.droneDrops += 1;
      e.drop = bomb ? "bomb" : wantPower && this.droneDrops % 3 === 0 ? "power" : "none";
    } else if (s.kind === "mite") {
      e.hp = e.max = 1;
      e.r = 11;
      e.score = 120;
      e.drop = bomb ? "bomb" : "none";
    } else if (s.kind === "swooper") {
      e.hp = e.max = 3;
      e.r = 18;
      e.score = 450;
      e.drop = bomb ? "bomb" : wantPower && s.dir > 0 ? "power" : "none";
    } else {
      e.hp = e.max = 16;
      e.r = 26;
      e.score = 900;
      e.drop = bomb ? "bomb" : wantPower ? "power" : "none";
    }
  }

  private spawnBoss() {
    const st = STAGES[this.stage];
    const queen = st.form === 5;
    this.boss = {
      alive: true,
      x: W / 2,
      y: -160,
      hp: Math.round(st.hp * 1.6),
      max: Math.round(st.hp * 1.6),
      t: 0,
      fire: 0.9,
      hit: 0,
      flag: 0,
      form: st.form,
      hitR: queen ? 118 : 78,
      bodyR: queen ? 70 : 46,
    };
    this.warn = "";
    this.shake = Math.max(this.shake, 8);
    this.noise(0.25, 0.08);
    this.emit(true);
  }

  private firePlayer(dt: number) {
    if (this.finale > 0) return;
    this.missileCd = Math.max(0, this.missileCd - dt);
    this.fireCd -= dt;
    const tier = this.power;
    const interval = tier === 0 ? 0.12 : tier === 1 ? 0.11 : 0.1;
    if (this.fireCd <= 0) {
      this.fireCd = interval;
      const patterns = [
        [{ x: 0, vx: 0 }],
        [{ x: -22, vx: -150 }, { x: 0, vx: 0 }, { x: 22, vx: 150 }],
        [{ x: -30, vx: -170 }, { x: -10, vx: -50 }, { x: 10, vx: 50 }, { x: 30, vx: 170 }],
      ];
      for (const s of patterns[tier]) {
        this.spawnBullet(this.pBullets, this.player.x + s.x, this.player.y - 28, s.vx, -980, 5, 0);
      }
      this.shotFlip ^= 1;
      if (this.shotFlip === 0) this.blip(920, 0.03, 0.012);
      this.burst(this.player.x, this.player.y + 18, 1, "#3ee0ff", 40);
    }
    if (tier >= 2 && this.missileCd <= 0) {
      this.missileCd = 0.48;
      this.spawnBullet(this.pBullets, this.player.x - 18, this.player.y - 6, -70, -540, 6, 0, true);
      this.spawnBullet(this.pBullets, this.player.x + 18, this.player.y - 6, 70, -540, 6, 0, true);
      this.blip(420, 0.05, 0.02);
    }
  }

  private spawnBullet(
    pool: Bullet[],
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    kind: 0 | 1 | 2,
    homing = false,
  ) {
    const b = pool.find((item) => !item.alive);
    if (!b) return;
    b.alive = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = r;
    b.kind = kind;
    b.grazed = false;
    b.homing = homing;
    b.age = 0;
  }

  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.t += dt;
      if (e.kind === "drone") {
        e.y += e.vy * dt;
        e.x = e.originX + Math.sin(e.t * 2.4 + e.phase) * 36;
      } else if (e.kind === "mite") {
        e.y += e.vy * dt;
        e.x = e.originX + Math.sin(e.t * 6 + e.phase) * 10;
      } else if (e.kind === "swooper") {
        e.x += e.vx * dt;
        e.y += 36 * dt;
        if (!e.shot && e.x > 40 && e.x < W - 40) {
          e.shot = true;
          this.aimVolley(e.x, e.y, 280, 3, 0.2, 5, 1);
        }
      } else if (e.y < 200) {
        e.y += 120 * dt;
      } else {
        e.y = 200 + Math.sin(e.t * 1.6) * 18;
        e.x = e.originX + Math.sin(e.t * 0.9) * 36;
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = 1.05;
          this.aimVolley(e.x, e.y + 10, 270, 3, 0.14, 5, 1);
        }
      }
      if ((e.kind === "drone" || e.kind === "mite") && e.y > 30 && e.y < this.player.y - 40) {
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = e.kind === "mite" ? 1.25 : 1.45;
          this.aimVolley(e.x, e.y, e.kind === "mite" ? 240 : 260, 1, 0, 5, 1);
        }
      }
      const gone = e.y > H + 70 || (e.kind === "swooper" && (e.x < -80 || e.x > W + 80) && e.t > 0.4);
      if (gone) e.alive = false;
    }
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b?.alive) return;
    b.t += dt;
    b.hit = Math.max(0, b.hit - dt);
    const enter = clamp(b.t / 1.3, 0, 1);
    const ease = 1 - (1 - enter) * (1 - enter);
    const restY = b.form === 5 ? 200 : 168;
    b.x = W / 2 + Math.sin(b.t * 0.65) * (b.form === 5 ? 150 : 120);
    b.y = -120 + (restY + 120) * ease + Math.sin(b.t * 1.2) * 16;
    if (enter < 1 || this.finale > 0 || this.clearing > 0) return;

    const ratio = b.hp / b.max;
    if (ratio < 0.5 && (b.flag & 1) === 0) {
      b.flag |= 1;
      this.shake = Math.max(this.shake, 7);
    }
    b.fire -= dt;
    if (b.fire > 0) return;

    if (this.stage < 5) {
      const tight = Math.floor(b.t / 2.4) % 2 === 1;
      b.fire = tight ? 0.5 : 0.78;
      this.aimVolley(b.x, b.y + 16, 150 + this.stage * 16, tight ? 3 : 7, tight ? 0.12 : 0.16, 5, 2);
      return;
    }

    const speedMul = ratio < 0.33 ? 1.18 : 1;
    const mode = b.t < 3.2 ? 0 : Math.floor(b.t / 3.4) % 3;
    if (mode === 0) {
      b.fire = ratio < 0.5 ? 0.55 : 0.72;
      this.aimVolley(b.x, b.y, 160 * speedMul, 9, 0.14, 6, 2);
    } else if (mode === 1) {
      b.fire = 0.42;
      this.aimVolley(b.x, b.y + 20, 280 * speedMul, 5, 0.1, 5, 2);
    } else {
      b.fire = 0.28;
      const gapX = this.player.x;
      for (let x = 36; x <= W - 36; x += 48) {
        if (Math.abs(x - gapX) < 70) continue;
        this.aimVolley(x, b.y + 36, 250 * speedMul, 1, 0, 5, 2);
      }
    }
  }

  private aimVolley(
    x: number,
    y: number,
    speed: number,
    count: number,
    spread: number,
    r: number,
    kind: 1 | 2,
  ) {
    const base = Math.atan2(this.player.y - y, this.player.x - x);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      this.spawnBullet(this.eBullets, x, y, Math.cos(a) * speed, Math.sin(a) * speed, r, kind);
    }
  }

  private nearestTarget(x: number, y: number) {
    let bestX = 0;
    let bestY = 0;
    let best = 1e12;
    let found = false;
    const consider = (tx: number, ty: number) => {
      if (ty > y + 36) return;
      const d = (tx - x) * (tx - x) + (ty - y) * (ty - y);
      if (d < best) {
        best = d;
        bestX = tx;
        bestY = ty;
        found = true;
      }
    };
    for (const e of this.enemies) if (e.alive) consider(e.x, e.y);
    if (this.boss?.alive) consider(this.boss.x, this.boss.y);
    return found ? { x: bestX, y: bestY } : null;
  }

  private updateBullets(dt: number) {
    for (const b of this.pBullets) {
      if (!b.alive) continue;
      b.age += dt;
      if (b.homing) {
        const target = this.nearestTarget(b.x, b.y);
        if (target) {
          const ang = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = Math.atan2(Math.sin(ang - cur), Math.cos(ang - cur));
          diff = clamp(diff, -5.2 * dt, 5.2 * dt);
          const na = cur + diff;
          b.vx = Math.cos(na) * 560;
          b.vy = Math.sin(na) * 560;
        }
        if (b.age > 2.6) b.alive = false;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.y > H + 40 || b.x < -40 || b.x > W + 40) b.alive = false;
    }
    for (const b of this.eBullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 40 || b.y < -40 || b.x < -40 || b.x > W + 40) b.alive = false;
    }
  }

  private updatePicks(dt: number) {
    for (const p of this.picks) {
      if (!p.alive) continue;
      p.life -= dt;
      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 120) {
        p.x += (dx / d) * 320 * dt;
        p.y += (dy / d) * 320 * dt;
      } else p.y += 80 * dt;
      if (d < 26) {
        p.alive = false;
        if (p.kind === "power") {
          if (this.power < 2) {
            this.power += 1;
            this.banner = this.power === 1 ? "3줄기" : "4줄기 + 유도탄";
          } else {
            this.score += 800;
            this.banner = "무장 최대";
          }
          this.bannerT = 1.25;
          this.warn = this.banner;
        } else this.bombs = Math.min(6, this.bombs + 1);
        this.blip(p.kind === "power" ? 740 : 520, 0.08, 0.04);
        this.score += 50;
        this.emit(true);
      } else if (p.life <= 0 || p.y > H + 20) p.alive = false;
    }
  }

  private updateParts(dt: number) {
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life <= 0) p.alive = false;
    }
  }

  private collide() {
    for (const b of this.pBullets) {
      if (!b.alive) continue;
      const dmg = b.homing ? 2 : 1;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (b.r + e.r) * (b.r + e.r)) {
          b.alive = false;
          e.hp -= dmg;
          this.burst(b.x, b.y, 3, b.homing ? "#e4b15a" : "#3ee0ff", 120);
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
      const boss = this.boss;
      if (b.alive && boss?.alive) {
        const dx = b.x - boss.x;
        const dy = b.y - boss.y;
        if (dx * dx + dy * dy < boss.hitR * boss.hitR) {
          b.alive = false;
          boss.hp -= dmg;
          boss.hit = 0.06;
          if (boss.hp <= 0) this.defeatBoss();
        }
      }
    }

    if (this.inv > 0 || this.finale > 0 || this.clearing > 0 || this.phase !== "play") return;
    const pr = 8;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      if (dx * dx + dy * dy < (pr + e.r * 0.65) * (pr + e.r * 0.65)) {
        this.hurt();
        return;
      }
    }
    if (this.boss?.alive) {
      const dx = this.player.x - this.boss.x;
      const dy = this.player.y - this.boss.y;
      if (dx * dx + dy * dy < this.boss.bodyR * this.boss.bodyR) {
        this.hurt();
        return;
      }
    }
    for (const b of this.eBullets) {
      if (!b.alive) continue;
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < pr + b.r) {
        b.alive = false;
        this.hurt();
        return;
      }
      if (!b.grazed && d < 30) {
        b.grazed = true;
        this.score += 40;
        this.burst(b.x, b.y, 1, "#f6f1e6", 30);
      }
    }
  }

  private killEnemy(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
    this.chainTimer = 2;
    const mult = Math.min(8, this.chain);
    this.score += e.score * mult;
    this.burst(e.x, e.y, e.kind === "turret" ? 16 : 8, "#e4b15a", 220);
    this.noise(0.12, 0.05);
    if (e.drop !== "none") this.drop(e.x, e.y, e.drop);
  }

  private drop(x: number, y: number, kind: "power" | "bomb") {
    const p = this.picks.find((item) => !item.alive);
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.kind = kind;
    p.life = 8;
  }

  private defeatBoss() {
    if (!this.boss || this.finale > 0 || this.clearing > 0) return;
    this.boss.alive = false;
    this.boss.hp = 0;
    this.score += this.stage >= 5 ? 30000 : 6000 + this.stage * 1500;
    this.shake = 14;
    this.flash = 0.5;
    this.burst(this.boss.x, this.boss.y, 36, "#3ee0ff", 360);
    this.burst(this.boss.x, this.boss.y, 20, "#e4b15a", 220);
    this.noise(0.35, 0.09);
    for (const b of this.eBullets) b.alive = false;
    for (const e of this.enemies) e.alive = false;
    if (this.stage >= 5) {
      this.finale = 2.3;
      this.inv = 3;
    } else {
      this.clearing = 2.1;
      this.inv = 2.2;
      this.warn = "스테이지 돌파";
    }
    this.emit(true);
  }

  private hurt() {
    this.lives -= 1;
    this.inv = 2.3;
    this.shake = Math.max(this.shake, 11);
    this.flash = 0.25;
    this.noise(0.18, 0.07);
    this.burst(this.player.x, this.player.y, 18, "#f6f1e6", 260);
    for (const b of this.eBullets) {
      const dx = b.x - this.player.x;
      const dy = b.y - this.player.y;
      if (dx * dx + dy * dy < 200 * 200) b.alive = false;
    }
    if (this.lives <= 0) {
      this.phase = "over";
      this.commitScore();
      this.burst(this.player.x, this.player.y, 30, "#e4b15a", 300);
      this.emit(true);
    }
  }

  private burst(x: number, y: number, n: number, color: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.partCursor];
      this.partCursor = (this.partCursor + 1) % this.parts.length;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.max = 0.25 + Math.random() * 0.35;
      p.life = p.max;
      p.size = 1.5 + Math.random() * 2.8;
      p.color = color;
    }
  }

  private commitScore() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
  }

  private emit(force: boolean) {
    const bossHp = this.boss ? clamp(this.boss.hp / this.boss.max, 0, 1) : -1;
    const hud: Hud = {
      phase: this.phase,
      score: this.score,
      best: this.best,
      lives: this.lives,
      bombs: this.bombs,
      bossHp,
      bossName: this.boss ? STAGES[this.stage].boss : "",
      sector: this.sector,
      warn: this.warn,
      focus: this.focus,
      chain: this.chainTimer > 0 ? this.chain : 0,
      power: this.power,
      stage: this.stage + 1,
      rank: this.phase === "over" || this.phase === "win" ? rankOf(this.score) : "",
    };
    const sig = `${hud.phase}|${hud.score}|${hud.lives}|${hud.bombs}|${hud.chain}|${hud.stage}|${hud.sector}|${hud.warn}|${hud.focus}|${Math.round(bossHp * 40)}|${hud.power}|${hud.rank}`;
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;
    this.onHud(hud);
  }

  private draw() {
    const ctx = this.ctx;
    const shakeMag = this.reduceMotion ? 0 : this.shake;
    this.shake *= 0.9;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.016);
    const sx = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    const sy = shakeMag ? (Math.random() - 0.5) * shakeMag : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(sx, sy);
    this.drawWorld(ctx);
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(246, 241, 230, ${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private beginBgFade(from: number) {
    if (this.reduceMotion) {
      this.bgFade = 0;
      return;
    }
    this.bgFrom = from;
    this.bgFade = BG_FADE;
  }

  private ensureBgCanvas() {
    if (this.bgCtx) return;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    this.bgCanvas = canvas;
    this.bgCtx = canvas.getContext("2d");
  }

  private drawStageBackdrop(ctx: CanvasRenderingContext2D) {
    const fading = this.bgFade > 0 && this.bgFrom !== this.stage;
    if (!fading) {
      this.drawBackdrop(ctx, this.stage);
      return;
    }
    this.ensureBgCanvas();
    const layer = this.bgCtx;
    const bitmap = this.bgCanvas;
    if (!layer || !bitmap) {
      this.drawBackdrop(ctx, this.stage);
      return;
    }
    const linear = 1 - this.bgFade / BG_FADE;
    const next = linear * linear * (3 - 2 * linear);
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, W, H);
    this.drawBackdrop(layer, this.bgFrom);
    ctx.drawImage(bitmap, 0, 0);
    layer.clearRect(0, 0, W, H);
    this.drawBackdrop(layer, this.stage);
    ctx.save();
    ctx.globalAlpha = next;
    ctx.drawImage(bitmap, 0, 0);
    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, stage = this.stage) {
    const st = STAGES[stage];
    const hue = st.hue;
    const form = st.form;
    const t = this.scroll;
    const calm = this.reduceMotion;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `hsl(${hue} 48% 14%)`);
    sky.addColorStop(0.45, `hsl(${hue + 12} 44% 8%)`);
    sky.addColorStop(1, `hsl(${(hue + 28) % 360} 52% 3%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const bloom = ctx.createRadialGradient(W * 0.5, H * 0.18, 20, W * 0.5, H * 0.22, H * 0.55);
    bloom.addColorStop(0, `hsla(${hue + 20}, 70%, 55%, 0.16)`);
    bloom.addColorStop(0.55, `hsla(${hue}, 55%, 35%, 0.06)`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // Far starfield / dust
    for (let i = 0; i < 64; i++) {
      const depth = 0.18 + (i % 5) * 0.14;
      const y = ((i * 97 + t * (12 + depth * 28)) % (H + 40)) - 20;
      const x = (i * 131 + (i % 7) * 17) % W;
      const size = i % 11 === 0 ? 2.4 : i % 5 === 0 ? 1.6 : 1.1;
      ctx.globalAlpha = 0.18 + (i % 4) * 0.1;
      ctx.fillStyle = i % 3 === 0 ? "#3ee0ff" : i % 3 === 1 ? "#f6f1e6" : `hsl(${hue + 40} 70% 70%)`;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;

    if (form === 0) this.drawDesertBg(ctx, t, hue, calm);
    else if (form === 1) this.drawCableBg(ctx, t, hue, calm);
    else if (form === 2) this.drawCityBg(ctx, t, hue, calm);
    else if (form === 3) this.drawIceBg(ctx, t, hue, calm);
    else if (form === 4) this.drawCloudBg(ctx, t, hue, calm);
    else this.drawChaosBg(ctx, t, hue, calm);

    ctx.globalAlpha = 0.035;
    ctx.fillStyle = "#f6f1e6";
    for (let i = 0; i < 3; i++) {
      const y = (t * 1.6 + i * 340) % (H + 80) - 20;
      ctx.fillRect(0, y, W, 6);
    }
    ctx.globalAlpha = 1;
  }

  private drawDesertBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    // Rolling dunes
    for (let layer = 0; layer < 3; layer++) {
      const speed = 0.55 + layer * 0.85;
      const amp = 18 + layer * 22;
      const base = H * (0.42 + layer * 0.18);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 18) {
        const y = base + Math.sin(x * 0.018 + t * 0.012 * speed + layer) * amp + Math.sin(x * 0.05 + layer * 2) * (8 + layer * 4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue + layer * 8}, ${38 + layer * 8}%, ${12 + layer * 5}%, ${0.55 - layer * 0.1})`;
      ctx.fill();
    }

    // Data monoliths
    for (let i = 0; i < 10; i++) {
      const lane = (i * 73 + 40) % (W - 40);
      const h = 70 + (i % 5) * 28;
      const y = ((i * 190 + t * (1.1 + (i % 3) * 0.35)) % (H + h + 80)) - h;
      ctx.fillStyle = `hsla(${hue + 10}, 30%, ${16 + (i % 3) * 4}%, 0.7)`;
      ctx.fillRect(lane, y, 14 + (i % 3) * 6, h);
      ctx.fillStyle = `hsla(${hue + 40}, 70%, 55%, 0.35)`;
      ctx.fillRect(lane + 3, y + 8, 3, h * 0.35);
      if (!calm && i % 2 === 0) {
        ctx.globalAlpha = 0.25 + Math.sin(t * 0.08 + i) * 0.1;
        ctx.fillStyle = "#3ee0ff";
        ctx.fillRect(lane + 8, y + 12, 2, 10 + (i % 4) * 4);
        ctx.globalAlpha = 1;
      }
    }

    // Dust motes
    ctx.fillStyle = `hsla(${hue + 20}, 60%, 65%, 0.35)`;
    for (let i = 0; i < 28; i++) {
      const x = (i * 89 + t * (0.4 + (i % 4) * 0.2) * (calm ? 0.3 : 1)) % W;
      const y = (i * 67 + t * (1.6 + (i % 3) * 0.5)) % H;
      ctx.globalAlpha = 0.15 + (i % 5) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawCableBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    // Light shafts from surface
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 110 + Math.sin(t * 0.02 + i) * (calm ? 0 : 18);
      const g = ctx.createLinearGradient(x, 0, x + 40, H);
      g.addColorStop(0, `hsla(${hue + 30}, 80%, 70%, 0.14)`);
      g.addColorStop(0.5, `hsla(${hue}, 60%, 40%, 0.04)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 70, 0);
      ctx.lineTo(x + 30, H);
      ctx.lineTo(x - 40, H);
      ctx.closePath();
      ctx.fill();
    }

    // Thick undersea cables
    for (let i = 0; i < 4; i++) {
      const baseX = 60 + i * 130;
      ctx.strokeStyle = `hsla(${hue - 10}, 35%, ${22 + i * 4}%, 0.85)`;
      ctx.lineWidth = 10 + (i % 2) * 4;
      ctx.beginPath();
      for (let y = -40; y <= H + 40; y += 24) {
        const x = baseX + Math.sin((y + t * (1.2 + i * 0.3)) * 0.012 + i) * (36 + i * 8);
        if (y === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = `hsla(${hue + 40}, 80%, 60%, 0.25)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Bubbles
    for (let i = 0; i < 22; i++) {
      const x = (i * 97 + Math.sin(t * 0.03 + i) * 20) % W;
      const y = H - ((i * 73 + t * (1.8 + (i % 4) * 0.6)) % (H + 40));
      const r = 2 + (i % 5);
      ctx.globalAlpha = 0.18 + (i % 4) * 0.06;
      ctx.strokeStyle = `hsla(${hue + 20}, 70%, 75%, 0.8)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawCityBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    // Perspective neon grid floor fading upward as "far city"
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = `hsl(${hue + 20} 80% 65%)`;
    ctx.lineWidth = 1;
    const vanishing = H * 0.28;
    for (let i = 0; i < 12; i++) {
      const y = vanishing + ((i * 70 + t * 2.2) % (H - vanishing + 40));
      const fade = clamp(1 - (y - vanishing) / (H - vanishing), 0, 1);
      ctx.globalAlpha = 0.06 + fade * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 8, vanishing);
      ctx.lineTo(W / 2 + i * 90, H);
      ctx.stroke();
    }
    ctx.restore();

    // Building silhouettes scrolling
    for (let i = 0; i < 14; i++) {
      const w = 28 + (i % 5) * 14;
      const h = 90 + (i % 7) * 38;
      const x = (i * 61) % (W + 40) - 20;
      const y = ((i * 170 + t * (1.3 + (i % 3) * 0.4)) % (H + h + 60)) - h;
      ctx.fillStyle = `hsla(${hue}, 40%, ${8 + (i % 3) * 3}%, 0.82)`;
      ctx.fillRect(x, y, w, h);
      // windows
      ctx.fillStyle = `hsla(${hue + 40}, 90%, 70%, ${calm ? 0.25 : 0.2 + Math.sin(t * 0.1 + i) * 0.08})`;
      for (let wy = y + 10; wy < y + h - 8; wy += 14) {
        for (let wx = x + 5; wx < x + w - 6; wx += 10) {
          if ((wx + wy + i) % 3 === 0) continue;
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
      ctx.fillStyle = `hsla(${hue + 30}, 80%, 60%, 0.45)`;
      ctx.fillRect(x, y, w, 2);
    }
  }

  private drawIceBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    // Distant planet body
    ctx.beginPath();
    ctx.arc(W * 0.78, H * 0.16, 90, 0, Math.PI * 2);
    const planet = ctx.createRadialGradient(W * 0.78, H * 0.16, 10, W * 0.78, H * 0.16, 90);
    planet.addColorStop(0, `hsla(${hue + 20}, 50%, 55%, 0.35)`);
    planet.addColorStop(0.7, `hsla(${hue}, 40%, 25%, 0.18)`);
    planet.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = planet;
    ctx.fill();

    // Ice shards / crystals
    for (let i = 0; i < 12; i++) {
      const x = (i * 79 + 30) % W;
      const h = 50 + (i % 4) * 36;
      const y = ((i * 155 + t * (0.9 + (i % 3) * 0.35)) % (H + h + 50)) - h;
      const lean = (i % 2 ? 1 : -1) * (10 + (i % 3) * 6);
      ctx.fillStyle = `hsla(${hue}, 45%, ${55 + (i % 3) * 8}%, 0.22)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + lean, y + h * 0.45);
      ctx.lineTo(x + 4, y + h);
      ctx.lineTo(x - 10, y + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `hsla(${hue + 30}, 70%, 80%, 0.35)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Frost sparkles
    for (let i = 0; i < 30; i++) {
      const x = (i * 53 + t * (calm ? 0.2 : 0.6)) % W;
      const y = (i * 71 + t * 1.5) % H;
      ctx.globalAlpha = 0.2 + (i % 4) * 0.08;
      ctx.fillStyle = "#d9f4ff";
      ctx.fillRect(x, y, i % 7 === 0 ? 2.5 : 1.2, i % 7 === 0 ? 2.5 : 1.2);
    }
    ctx.globalAlpha = 1;
  }

  private drawCloudBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    for (let i = 0; i < 10; i++) {
      const layer = i % 3;
      const x = ((i * 97 + t * (0.35 + layer * 0.25) * (calm ? 0.4 : 1)) % (W + 160)) - 80;
      const y = 80 + ((i * 140 + t * (0.7 + layer * 0.4)) % (H + 100)) - 40;
      const scale = 0.7 + layer * 0.35;
      ctx.globalAlpha = 0.12 + layer * 0.08;
      ctx.fillStyle = `hsl(${hue + 10} 40% ${55 + layer * 10}%)`;
      this.blob(ctx, x, y, 70 * scale, 28 * scale);
      this.blob(ctx, x + 38 * scale, y - 8 * scale, 50 * scale, 22 * scale);
      this.blob(ctx, x - 30 * scale, y + 6 * scale, 44 * scale, 18 * scale);
    }
    ctx.globalAlpha = 1;

    // Floating platforms / canopy islands
    for (let i = 0; i < 6; i++) {
      const x = 50 + (i * 95) % (W - 80);
      const y = ((i * 210 + t * 1.15) % (H + 80)) - 40;
      ctx.fillStyle = `hsla(${hue - 20}, 35%, 18%, 0.75)`;
      ctx.beginPath();
      ctx.ellipse(x, y, 48 + (i % 3) * 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `hsla(${hue + 30}, 55%, 40%, 0.35)`;
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 36 + (i % 3) * 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawChaosBg(ctx: CanvasRenderingContext2D, t: number, hue: number, calm: boolean) {
    const cx = W / 2;
    const cy = H * 0.38;
    const pulse = calm ? 1 : 1 + Math.sin(t * 0.08) * 0.06;

    for (let ring = 0; ring < 4; ring++) {
      const r = (70 + ring * 48) * pulse;
      ctx.strokeStyle = `hsla(${(hue + ring * 25 + t) % 360}, 70%, 60%, ${0.18 - ring * 0.03})`;
      ctx.lineWidth = 2 + ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r, t * 0.02 * (ring % 2 ? 1 : -1), t * 0.02 * (ring % 2 ? 1 : -1) + Math.PI * 1.4);
      ctx.stroke();
    }

    // Jagged debris
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + t * 0.015;
      const dist = 80 + (i % 5) * 55 + Math.sin(t * 0.05 + i) * 12;
      const x = cx + Math.cos(ang) * dist;
      const y = (cy + Math.sin(ang) * dist * 0.7 + t * (0.8 + (i % 3) * 0.3)) % (H + 60) - 30;
      ctx.fillStyle = `hsla(${(hue + i * 18) % 360}, 65%, 45%, 0.35)`;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 8, y + 4);
      ctx.lineTo(x - 2, y + 12);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.fill();
    }

    // Core glow
    const core = ctx.createRadialGradient(cx, cy, 4, cx, cy, 120);
    core.addColorStop(0, `hsla(${hue + 40}, 90%, 70%, 0.28)`);
    core.addColorStop(0.4, `hsla(${hue}, 70%, 40%, 0.12)`);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, W, H);
  }

  private blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawWorld(ctx: CanvasRenderingContext2D) {
    this.scroll += this.phase === "play" ? 1.4 : 0.35;
    this.drawStageBackdrop(ctx);

    const pulse = 1 + Math.sin(this.scroll * 0.35) * 0.08;
    for (const p of this.picks) {
      if (!p.alive) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(pulse, pulse);
      if (p.kind === "power") {
        ctx.fillStyle = "rgba(62,224,255,0.28)";
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3ee0ff";
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(13, 9);
        ctx.lineTo(0, 3);
        ctx.lineTo(-13, 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f4fdff";
        ctx.fillRect(-1.6, -7, 3.2, 11);
      } else {
        ctx.fillStyle = "#e4b15a";
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1a1208";
        ctx.font = "700 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("B", 0, 1);
      }
      ctx.restore();
    }

    for (const b of this.eBullets) {
      if (!b.alive) continue;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255, 72, 18, 0.42)";
      ctx.arc(b.x, b.y, b.kind === 2 ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "#ff4d1c";
      ctx.arc(b.x, b.y, b.kind === 2 ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const img = e.kind === "turret" ? this.imgs.turret : e.kind === "swooper" ? this.imgs.swooper : this.imgs.drone;
      const h = e.kind === "turret" ? 78 : e.kind === "swooper" ? 58 : e.kind === "mite" ? 34 : 48;
      this.blit(ctx, img, e.x, e.y, h, 0);
      if (e.kind === "turret" && e.hp < e.max) {
        ctx.fillStyle = "rgba(246,241,230,0.25)";
        ctx.fillRect(e.x - 18, e.y - 40, 36, 3);
        ctx.fillStyle = "#3ee0ff";
        ctx.fillRect(e.x - 18, e.y - 40, 36 * (e.hp / e.max), 3);
      }
    }

    if (this.boss && (this.boss.alive || this.finale > 0)) {
      const b = this.boss;
      const look = this.bossLook(b.form);
      const flicker = b.hit > 0 ? 0.45 : 0;
      ctx.save();
      ctx.globalAlpha = this.finale > 0 ? clamp(this.finale / 2.3, 0, 1) : 1;
      this.blit(ctx, look.img, b.x, b.y, look.h, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(62, 224, 255, ${0.55 + Math.sin(b.t * 8) * 0.2})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y - 6, b.form === 5 ? 16 : 10, 0, Math.PI * 2);
      ctx.fill();
      if (flicker) {
        ctx.fillStyle = `rgba(246,241,230,${flicker})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.form === 5 ? 70 : 40, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const b of this.pBullets) {
      if (!b.alive) continue;
      if (b.homing) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        ctx.fillStyle = "rgba(228,177,90,0.45)";
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(5, 6);
        ctx.lineTo(-5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff4d2";
        ctx.fillRect(-1.4, -6, 2.8, 8);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(62, 224, 255, 0.35)";
        ctx.fillRect(b.x - 4, b.y - 14, 8, 22);
        ctx.fillStyle = "#f4fdff";
        ctx.fillRect(b.x - 1.6, b.y - 12, 3.2, 16);
      }
    }

    if (this.phase !== "over" && (this.inv <= 0 || Math.floor(this.inv * 16) % 2 === 0)) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.bank);
      const img = this.imgs.player;
      if (img.complete && img.naturalWidth) {
        const h = 78;
        const w = h * (img.naturalWidth / img.naturalHeight);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = "#d9dee8";
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(16, 20);
        ctx.lineTo(0, 12);
        ctx.lineTo(-16, 20);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(62,224,255,0.8)";
      ctx.fillRect(-7, 24, 4, 10 + Math.random() * 6);
      ctx.fillRect(3, 24, 4, 10 + Math.random() * 6);
      ctx.restore();
    }

    for (const p of this.parts) {
      if (!p.alive) continue;
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  private bossLook(form: number) {
    if (form === 5) return { img: this.imgs.boss, h: 250 };
    if (form === 1 || form === 3) return { img: this.imgs.swooper, h: 168 };
    if (form === 4) return { img: this.imgs.drone, h: 150 };
    return { img: this.imgs.turret, h: 172 };
  }

  private blit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, height: number, rot: number) {
    if (!img.complete || !img.naturalWidth) return;
    const w = height * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(img, -w / 2, -height / 2, w, height);
    ctx.restore();
  }
}
