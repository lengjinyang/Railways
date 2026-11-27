// Procedural Web Audio API SFX & Continuous Ambient Soundscape (E) — zero external audio assets.
import type { WeatherKind, ZoneKind } from './world/types';

class SoundFX {
  private ctx: AudioContext | null = null;
  public muted = false;

  // Persistent ambient bed nodes
  private ambientInit = false;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private boilerGain: GainNode | null = null;
  private boilerOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private creakCd = 4;
  /** True while the page is hidden: the whole audio graph is suspended (no sound in the background). */
  private backgrounded = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  constructor() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      this.backgrounded = document.visibilityState === 'hidden';
      if (!this.ctx) return;
      if (this.backgrounded) void this.ctx.suspend();
      else if (!this.muted) void this.ctx.resume();
    });
  }

  private ensure(): AudioContext | null {
    if (this.muted || this.backgrounded || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private initAmbient(ctx: AudioContext): void {
    if (this.ambientInit) return;
    this.ambientInit = true;

    // Create a 3-second looping pink-ish noise buffer shared by wind & train rumble
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
    }

    // 1. Wind bed
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSrc.start();
    this.windFilter = windFilter;
    this.windGain = windGain;

    // 2. Train rolling rumble
    const rumSrc = ctx.createBufferSource();
    rumSrc.buffer = buf;
    rumSrc.loop = true;
    const rumFilter = ctx.createBiquadFilter();
    rumFilter.type = 'lowpass';
    rumFilter.frequency.value = 130;
    const rumGain = ctx.createGain();
    rumGain.gain.value = 0;
    rumSrc.connect(rumFilter);
    rumFilter.connect(rumGain);
    rumGain.connect(ctx.destination);
    rumSrc.start();
    this.rumbleGain = rumGain;

    // 3. Boiler / blue-fire hum
    const bOsc = ctx.createOscillator();
    bOsc.type = 'triangle';
    bOsc.frequency.value = 56;
    const bFilter = ctx.createBiquadFilter();
    bFilter.type = 'lowpass';
    bFilter.frequency.value = 160;
    const bGain = ctx.createGain();
    bGain.gain.value = 0;
    bOsc.connect(bFilter);
    bFilter.connect(bGain);
    bGain.connect(ctx.destination);
    bOsc.start();
    this.boilerOsc = bOsc;
    this.boilerGain = bGain;
  }

  /** Smoothly updates continuous ambient bed (wind, boiler hum, rolling rumble, wood creak). */
  updateAmbient(
    dt: number,
    trainSpeed: number,
    weather: WeatherKind,
    boilerRatio: number,
    zone: ZoneKind,
    active: boolean
  ): void {
    if (typeof window === 'undefined') return;
    if (this.muted || !active) {
      if (this.ctx && this.ambientInit) {
        const now = this.ctx.currentTime;
        this.windGain?.gain.setTargetAtTime(0, now, 0.15);
        this.rumbleGain?.gain.setTargetAtTime(0, now, 0.15);
        this.boilerGain?.gain.setTargetAtTime(0, now, 0.15);
      }
      return;
    }
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.initAmbient(this.ctx);
    const now = this.ctx.currentTime;
    const speedNorm = Math.min(1, trainSpeed / 205);

    // Wind varies by weather & zone
    let targetWind = 0.032 + speedNorm * 0.035;
    let targetFreq = 320 + speedNorm * 180;
    if (weather === 'rainstorm') {
      targetWind = 0.11;
      targetFreq = 680;
    } else if (weather === 'blizzard') {
      targetWind = 0.13;
      targetFreq = 520;
    } else if (weather === 'sandstorm') {
      targetWind = 0.12;
      targetFreq = 420;
    } else if (weather === 'fog' || zone === 'sinking_belt') {
      targetWind = 0.055;
      targetFreq = 210;
    } else if (zone === 'ivy_city') {
      targetWind = 0.045;
      targetFreq = 440;
    }
    this.windGain?.gain.setTargetAtTime(targetWind, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(targetFreq, now, 0.4);

    // Train rolling rumble
    this.rumbleGain?.gain.setTargetAtTime(speedNorm > 0.02 ? 0.03 + speedNorm * 0.11 : 0, now, 0.25);

    // Boiler low hum (dims clearly as fuel runs low -> diegetic fuel cue!)
    const clampedBoiler = Math.max(0, Math.min(1, boilerRatio));
    const targetBoiler = clampedBoiler > 0 ? 0.012 + clampedBoiler * 0.045 + speedNorm * 0.025 : 0;
    this.boilerGain?.gain.setTargetAtTime(targetBoiler, now, 0.3);
    this.boilerOsc?.frequency.setTargetAtTime(48 + clampedBoiler * 14 + speedNorm * 16, now, 0.3);

    // Subtle carriage timber creak while moving
    if (speedNorm > 0.15) {
      this.creakCd -= dt;
      if (this.creakCd <= 0) {
        this.creakCd = 4.5 + Math.random() * 5.5;
        this.tone(this.jitter(145, 0.2), this.jitter(115, 0.2), 0.26, 'sine', 0.025);
      }
    }
  }

  private jitter(val: number, spread = 0.12): number {
    return val * (1 + (Math.random() * 2 - 1) * spread);
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainVal = 0.14,
    pan = 0
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.output(ctx, pan));
    osc.start(now);
    osc.stop(now + duration);
  }

  /** Destination, optionally through a stereo panner (-1 left .. 1 right). */
  private output(ctx: AudioContext, pan: number): AudioNode {
    if (!pan || typeof ctx.createStereoPanner !== 'function') return ctx.destination;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(ctx.destination);
    return p;
  }

  private noise(
    duration: number,
    gainVal = 0.15,
    freq = 400,
    filterType: BiquadFilterType = 'highpass',
    pan = 0
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.output(ctx, pan));
    src.start(now);
  }

  /** Something unseen moving nearby: a muffled, panned footfall. vol 0..1 by proximity. */
  unseenStep(pan: number, vol: number): void {
    const v = Math.max(0, Math.min(1, vol));
    if (v < 0.04) return;
    this.noise(0.09, 0.05 * v, this.jitter(260, 0.25), 'lowpass', pan);
    this.tone(this.jitter(92, 0.15), 60, 0.12, 'sine', 0.05 * v, pan);
  }

  /** Something unseen breathing / growling close behind. */
  unseenGrowl(pan: number, vol: number): void {
    const v = Math.max(0, Math.min(1, vol));
    if (v < 0.05) return;
    this.tone(this.jitter(118, 0.2), this.jitter(72, 0.15), 0.42, 'sawtooth', 0.028 * v, pan);
    this.noise(0.35, 0.03 * v, 420, 'bandpass', pan);
  }

  swing(): void {
    this.noise(0.07, 0.08, this.jitter(950), 'highpass');
    this.tone(this.jitter(250), 105, 0.07, 'sine', 0.08);
  }

  hitWood(): void {
    this.tone(this.jitter(210), this.jitter(95), 0.09, 'triangle', 0.18);
    this.noise(0.055, 0.14, this.jitter(650), 'bandpass');
  }

  breakWood(): void {
    this.tone(this.jitter(175), 60, 0.16, 'sawtooth', 0.16);
    this.noise(0.14, 0.22, 520, 'bandpass');
    setTimeout(() => this.noise(0.09, 0.14, 900, 'highpass'), 45);
  }

  hitMetal(): void {
    this.tone(this.jitter(720), this.jitter(360), 0.12, 'square', 0.1);
    this.tone(this.jitter(1240), this.jitter(820), 0.1, 'triangle', 0.09);
    this.noise(0.04, 0.08, 1800, 'highpass');
  }

  breakMetal(): void {
    this.tone(this.jitter(520), 140, 0.2, 'sawtooth', 0.15);
    this.tone(this.jitter(980), 420, 0.15, 'square', 0.1);
    this.noise(0.16, 0.18, 1100, 'highpass');
  }

  hitFlesh(): void {
    this.tone(this.jitter(180), 65, 0.1, 'sawtooth', 0.14);
    this.noise(0.06, 0.1, 300, 'highpass');
  }

  crossbow(): void {
    this.tone(this.jitter(520), 210, 0.07, 'triangle', 0.1);
    this.noise(0.04, 0.06, 1400, 'highpass');
  }

  shotgun(): void {
    this.noise(0.18, 0.24, 220, 'highpass');
    this.tone(150, 38, 0.16, 'sawtooth', 0.2);
  }

  rifle(): void {
    this.noise(0.12, 0.22, 480, 'bandpass');
    this.tone(360, 75, 0.12, 'sawtooth', 0.18);
  }

  windup(): void {
    this.tone(175, 390, 0.18, 'sawtooth', 0.09);
  }

  dodge(): void {
    this.noise(0.06, 0.07, 1400, 'highpass');
    this.tone(420, 680, 0.08, 'sine', 0.07);
  }

  railHammer(): void {
    this.tone(this.jitter(880, 0.08), 440, 0.11, 'triangle', 0.14);
    this.tone(this.jitter(1320, 0.06), 760, 0.08, 'square', 0.07);
    this.noise(0.04, 0.1, 2100, 'highpass');
  }

  crystalCharge(): void {
    this.tone(480, 780, 0.18, 'sine', 0.11);
    setTimeout(() => this.tone(720, 1040, 0.18, 'triangle', 0.08), 75);
  }

  steamVent(): void {
    this.noise(0.45, 0.16, 1800, 'bandpass');
    this.tone(320, 140, 0.35, 'sine', 0.06);
  }

  stomachGrowl(): void {
    this.tone(92, 64, 0.38, 'sine', 0.12);
    setTimeout(() => this.tone(78, 52, 0.28, 'triangle', 0.09), 180);
  }

  heartbeat(): void {
    this.tone(68, 42, 0.12, 'sine', 0.16);
    setTimeout(() => this.tone(62, 38, 0.12, 'sine', 0.12), 180);
  }

  rummage(): void {
    this.noise(0.09, 0.06, this.jitter(900, 0.2), 'bandpass');
  }

  omenHowl(): void {
    this.tone(240, 310, 0.55, 'sine', 0.09);
    setTimeout(() => this.tone(310, 165, 0.9, 'triangle', 0.08), 480);
  }

  turret(): void {
    this.noise(0.08, 0.12, 600, 'highpass');
    this.tone(420, 120, 0.08, 'square', 0.1);
  }

  pickup(): void {
    this.tone(this.jitter(560, 0.06), this.jitter(920, 0.06), 0.075, 'sine', 0.09);
  }

  build(): void {
    this.tone(220, 330, 0.07, 'triangle', 0.12);
    this.tone(330, 440, 0.09, 'triangle', 0.09);
  }

  lever(): void {
    this.tone(180, 260, 0.09, 'square', 0.09);
  }

  door(open: boolean): void {
    this.tone(open ? 220 : 320, open ? 360 : 180, 0.1, 'triangle', 0.11);
    this.noise(0.05, 0.06, 700, 'bandpass');
  }

  eat(): void {
    this.tone(310, 440, 0.08, 'sine', 0.09);
    setTimeout(() => this.tone(400, 560, 0.08, 'sine', 0.08), 80);
  }

  alert(): void {
    this.tone(520, 420, 0.14, 'triangle', 0.08);
  }

  couplerWarn(): void {
    this.tone(420, 230, 0.16, 'sawtooth', 0.11);
  }

  crash(): void {
    this.noise(0.32, 0.26, 120, 'highpass');
    this.tone(95, 28, 0.3, 'sawtooth', 0.2);
  }

  thunder(): void {
    this.noise(0.75, 0.22, 240, 'lowpass');
    this.tone(72, 26, 0.6, 'sawtooth', 0.14);
  }

  questDone(): void {
    this.tone(440, 554, 0.16, 'triangle', 0.11);
    setTimeout(() => this.tone(554, 659, 0.22, 'sine', 0.1), 130);
  }

  sort(): void {
    this.tone(480, 680, 0.06, 'sine', 0.07);
  }

  chug(boilerRatio = 1): void {
    const g = 0.015 + Math.max(0.15, boilerRatio) * 0.032;
    this.noise(0.06, g, 680, 'highpass');
  }

  flashlight(on: boolean): void {
    this.tone(on ? 880 : 620, on ? 1320 : 410, 0.045, 'square', 0.06);
  }

  uiClick(): void {
    this.tone(520, 680, 0.04, 'triangle', 0.055);
  }

  whistle(): void {
    this.tone(392, 384, 0.72, 'sawtooth', 0.07);
    this.tone(493.88, 486, 0.72, 'triangle', 0.08);
    this.noise(0.55, 0.045, 1600, 'bandpass');
  }

  gridDeny(): void {
    this.tone(175, 115, 0.08, 'sawtooth', 0.075);
  }

  lostWorldReveal(zone: ZoneKind): void {
    const chords: Record<ZoneKind, number[]> = {
      fallen_city: [196, 246.94, 293.66],
      rust_plains: [220, 261.63, 329.63],
      monster_wastes: [146.83, 174.61, 220],
      ivy_city: [261.63, 329.63, 392, 493.88],
      sinking_belt: [164.81, 196, 233.08],
      old_city: [196, 293.66, 392, 523.25],
    };
    const notes = chords[zone];
    notes.forEach((f, idx) => {
      setTimeout(() => {
        this.tone(f, f * 0.995, 1.2, idx === 0 ? 'triangle' : 'sine', idx === 0 ? 0.12 : 0.08);
      }, idx * 130);
    });
  }

  enterZone(zone: ZoneKind, tier: number): void {
    const scale = 1 + (Math.max(1, Math.min(5, tier)) - 1) * 0.05;
    if (zone === 'rust_plains' || zone === 'fallen_city') {
      this.tone(246 * scale, 220 * scale, 0.4, 'triangle', 0.1);
      setTimeout(() => this.tone(185 * scale, 165 * scale, 0.5, 'sine', 0.09), 180);
    } else if (zone === 'monster_wastes') {
      this.tone(130 * scale, 84, 0.45, 'sawtooth', 0.13);
      setTimeout(() => this.tone(116 * scale, 74, 0.48, 'sawtooth', 0.11), 230);
    } else if (zone === 'ivy_city') {
      const notes = [392, 493.88, 587.33, 739.99];
      notes.forEach((f, idx) => {
        setTimeout(() => this.tone(f, f * 1.01, 0.48, 'sine', 0.085), idx * 115);
      });
    } else if (zone === 'sinking_belt') {
      this.tone(110, 82, 0.7, 'triangle', 0.14);
      this.noise(0.55, 0.08, 190, 'lowpass');
    } else {
      this.tone(293.66, 288, 0.7, 'triangle', 0.12);
      setTimeout(() => this.tone(220, 214, 0.75, 'triangle', 0.11), 280);
    }
  }
}

export const sfx = new SoundFX();
