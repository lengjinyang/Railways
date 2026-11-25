// Procedural Web Audio API SFX — zero external audio assets needed.
class SoundFX {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensure(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
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

  private jitter(val: number, spread = 0.12): number {
    return val * (1 + (Math.random() * 2 - 1) * spread);
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainVal = 0.14
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
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private noise(duration: number, gainVal = 0.15, freq = 400, filterType: BiquadFilterType = 'highpass'): void {
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
    gain.connect(ctx.destination);
    src.start(now);
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
    this.tone(this.jitter(720), this.jitter(360), 0.12, 'square', 0.11);
    this.tone(this.jitter(1240), this.jitter(820), 0.1, 'triangle', 0.1);
    this.noise(0.04, 0.09, 1800, 'highpass');
  }

  breakMetal(): void {
    this.tone(this.jitter(520), 140, 0.2, 'sawtooth', 0.16);
    this.tone(this.jitter(980), 420, 0.15, 'square', 0.11);
    this.noise(0.16, 0.2, 1100, 'highpass');
  }

  hitBarrel(): void {
    this.tone(this.jitter(310), this.jitter(150), 0.14, 'sine', 0.2);
    this.tone(this.jitter(640), this.jitter(380), 0.09, 'triangle', 0.09);
    this.noise(0.04, 0.08, 1200, 'highpass');
  }

  hitFlesh(): void {
    this.tone(this.jitter(180), 65, 0.1, 'sawtooth', 0.14);
    this.noise(0.06, 0.1, 300, 'highpass');
  }

  shotgun(): void {
    this.noise(0.18, 0.24, 220, 'highpass');
    this.tone(150, 38, 0.16, 'sawtooth', 0.2);
  }

  turret(): void {
    this.noise(0.08, 0.12, 600, 'highpass');
    this.tone(420, 120, 0.08, 'square', 0.1);
  }

  pickup(): void {
    this.tone(this.jitter(540, 0.06), this.jitter(900, 0.06), 0.08, 'sine', 0.09);
  }

  build(): void {
    this.tone(220, 330, 0.07, 'triangle', 0.13);
    this.tone(330, 440, 0.09, 'triangle', 0.1);
  }

  lever(): void {
    this.tone(180, 260, 0.09, 'square', 0.1);
  }

  door(open: boolean): void {
    this.tone(open ? 220 : 320, open ? 360 : 180, 0.1, 'triangle', 0.12);
    this.noise(0.05, 0.07, 700, 'bandpass');
  }

  eat(): void {
    this.tone(320, 480, 0.08, 'sine', 0.1);
    setTimeout(() => this.tone(420, 620, 0.08, 'sine', 0.09), 70);
  }

  alert(): void {
    this.tone(640, 520, 0.16, 'sawtooth', 0.12);
  }

  couplerWarn(): void {
    this.tone(460, 240, 0.18, 'sawtooth', 0.15);
    setTimeout(() => this.tone(540, 260, 0.15, 'square', 0.12), 110);
  }

  crash(): void {
    this.noise(0.32, 0.28, 120, 'highpass');
    this.tone(95, 28, 0.3, 'sawtooth', 0.22);
  }

  thunder(): void {
    this.noise(0.75, 0.24, 240, 'lowpass');
    this.tone(72, 26, 0.6, 'sawtooth', 0.15);
  }

  questDone(): void {
    this.tone(523, 659, 0.12, 'triangle', 0.13);
    setTimeout(() => this.tone(659, 784, 0.16, 'triangle', 0.14), 100);
  }

  sort(): void {
    this.tone(480, 680, 0.06, 'sine', 0.08);
  }

  chug(): void {
    this.noise(0.06, 0.04, 700, 'highpass');
  }

  flashlight(on: boolean): void {
    this.tone(on ? 880 : 620, on ? 1320 : 410, 0.045, 'square', 0.07);
  }

  uiClick(): void {
    this.tone(520, 680, 0.04, 'triangle', 0.06);
  }

  whistle(): void {
    // Rich twin-tone steam locomotive whistle
    this.tone(392, 384, 0.72, 'sawtooth', 0.075);
    this.tone(493.88, 486, 0.72, 'triangle', 0.085);
    this.noise(0.55, 0.05, 1600, 'bandpass');
  }

  /** Ceremonial resonant brass horn + chime when stepping out into a new Lost World! */
  lostWorldReveal(zone: 'fallen_city' | 'exile' | 'monster' | 'fantasy' | 'old_city'): void {
    const chords: Record<typeof zone, number[]> = {
      fallen_city: [196, 246.94, 293.66],
      exile: [220, 261.63, 329.63, 440],
      monster: [146.83, 174.61, 220, 277.18],
      fantasy: [261.63, 329.63, 392, 523.25, 659.25],
      old_city: [196, 293.66, 392, 587.33],
    };
    const notes = chords[zone];
    notes.forEach((f, idx) => {
      setTimeout(() => {
        this.tone(f, f * 0.995, 1.1, idx === 0 ? 'triangle' : 'sine', idx === 0 ? 0.14 : 0.09);
      }, idx * 110);
    });
    this.noise(0.55, 0.04, 420, 'bandpass');
  }

  gridPlace(): void {
    this.tone(320, 440, 0.055, 'triangle', 0.09);
  }

  gridRotate(): void {
    this.tone(620, 780, 0.035, 'sine', 0.065);
  }

  gridDeny(): void {
    this.tone(180, 110, 0.09, 'sawtooth', 0.09);
  }

  /** Distinct zone-entry cue scaled by danger tier (1..5). */
  enterZone(zone: 'fallen_city' | 'exile' | 'monster' | 'fantasy' | 'old_city', tier: number): void {
    const scale = 1 + (Math.max(1, Math.min(5, tier)) - 1) * 0.07;
    if (zone === 'fallen_city' || zone === 'exile') {
      // Desolate wasteland wind + rusted railway bell
      this.noise(0.45, 0.08, 380, 'bandpass');
      this.tone(246 * scale, 220 * scale, 0.35, 'triangle', 0.13);
      setTimeout(() => this.tone(185 * scale, 165 * scale, 0.45, 'sine', 0.11), 160);
    } else if (zone === 'monster') {
      // Ominous beast horn + low growl pulse (more urgent at higher tiers)
      this.tone(130 * scale, 82, 0.42, 'sawtooth', 0.16);
      this.noise(0.32, 0.12, 220, 'lowpass');
      setTimeout(() => this.tone(116 * scale, 70, 0.46, 'sawtooth', 0.15), 220);
      if (tier >= 3) {
        setTimeout(() => this.tone(310 * scale, 230, 0.28, 'square', 0.1), 390);
      }
    } else if (zone === 'fantasy') {
      // Ethereal arcane chimes + shimmering chord
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, idx) => {
        setTimeout(() => this.tone(f * scale, f * scale * 1.02, 0.38, 'sine', 0.11), idx * 95);
      });
      setTimeout(() => this.tone(196, 146, 0.55, 'triangle', 0.09), 180);
    } else {
      // Old City: ancient cathedral bell + hollow bronze resonance
      this.tone(293.66, 288, 0.65, 'triangle', 0.15);
      this.tone(587.33, 580, 0.45, 'sine', 0.08);
      setTimeout(() => {
        this.tone(220, 214, 0.72, 'triangle', 0.14);
        this.tone(440, 434, 0.48, 'sine', 0.07);
      }, 280);
    }
  }
}

export const sfx = new SoundFX();
