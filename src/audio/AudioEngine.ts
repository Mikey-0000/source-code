// Original procedural audio: no samples, everything is synthesised with the Web Audio API.
import { settings, onSettings } from '../core/Settings';
type SfxName = 'jump' | 'land' | 'step' | 'compile' | 'error' | 'alert' | 'glitch' | 'beep' | 'type' | 'door' | 'death' | 'checkpoint' | 'memory' | 'hit' | 'laser' | 'click' | 'boot' | 'reveal' | 'eye';
class AudioEngine {
  ctx: AudioContext | null = null; master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; noiseBuf!: AudioBuffer;
  private droneNodes: { stop: () => void } | null = null; private droneTheme = ''; private tension = 0; private filt?: BiquadFilterNode; private lfoGain?: GainNode; private lastStep = 0;
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.sfxBus = c.createGain(); this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
    const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes(); onSettings(() => this.applyVolumes());
  }
  applyVolumes() { if (!this.ctx) return; this.musicBus.gain.value = settings.music * 0.55; this.sfxBus.gain.value = settings.sfx; }
  private tone(f: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0, bus?: GainNode) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when; const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus ?? this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, freq: number, vol: number, q = 1, type: BiquadFilterType = 'lowpass', when = 0, slideTo?: number) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + when; const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  sfx(n: SfxName) {
    if (!this.ctx) return;
    switch (n) {
      case 'jump': this.tone(180, .14, 'square', .12, 520); this.noise(.08, 1800, .05, 1, 'highpass'); break;
      case 'land': this.noise(.12, 380, .3); this.tone(70, .12, 'sine', .25, 40); break;
      case 'step': if (this.ctx.currentTime - this.lastStep > .13) { this.lastStep = this.ctx.currentTime; this.noise(.05, 700 + Math.random() * 300, .08); } break;
      case 'compile': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .16, 'square', .09, undefined, i * .07)); this.tone(1046, .4, 'sine', .08, undefined, .3); break;
      case 'error': this.tone(110, .28, 'sawtooth', .16, 70); this.tone(117, .28, 'square', .08, 60, .02); break;
      case 'alert': for (let i = 0; i < 3; i++) { this.tone(880, .09, 'square', .1, undefined, i * .16); this.tone(660, .09, 'square', .1, undefined, i * .16 + .08); } break;
      case 'glitch': this.noise(.18, 4000, .14, 4, 'bandpass', 0, 300); this.tone(60 + Math.random() * 300, .1, 'sawtooth', .07, 40); break;
      case 'beep': this.tone(990, .06, 'square', .07); break;
      case 'type': this.tone(1400 + Math.random() * 300, .016, 'square', .035); break;
      case 'door': this.tone(120, .5, 'sawtooth', .1, 50); this.noise(.5, 600, .12, 1, 'lowpass', 0, 120); break;
      case 'death': this.tone(300, .8, 'sawtooth', .16, 30); this.noise(.8, 3000, .16, 2, 'bandpass', 0, 100); break;
      case 'checkpoint': [392, 523, 784].forEach((f, i) => this.tone(f, .3, 'triangle', .1, undefined, i * .09)); break;
      case 'memory': [880, 1175, 1568, 1760].forEach((f, i) => this.tone(f, .5, 'sine', .06, f * .98, i * .08)); break;
      case 'hit': this.noise(.2, 900, .26, 1, 'lowpass', 0, 120); this.tone(140, .2, 'square', .12, 50); break;
      case 'laser': this.tone(70, .18, 'sawtooth', .04); break;
      case 'click': this.tone(700, .03, 'square', .05); break;
      case 'boot': this.tone(55, 2.4, 'sawtooth', .12, 220); this.noise(2, 200, .08, 1, 'lowpass', 0, 3000); break;
      case 'reveal': this.tone(40, 1.6, 'sawtooth', .22, 20); this.noise(1.2, 3000, .2, 3, 'bandpass', 0, 90); for (let i = 0; i < 5; i++) this.tone(200 + i * 90, .2, 'square', .06, undefined, .2 + i * .1); break;
      case 'eye': this.tone(48, 2, 'sine', .3, 30); this.tone(51, 2, 'sine', .25, 33); break;
    }
  }
  /** Ambient drone per theme. Intensity 0..1 modulates filter and pulse (corruption / boss). */
  startDrone(theme: 'boot' | 'exception' | 'root' | 'title' | 'boss' | 'void') {
    const c = this.ctx; if (!c || this.droneTheme === theme) return; this.stopDrone(); this.droneTheme = theme;
    const base = { boot: 55, exception: 49, root: 65.4, title: 41.2, boss: 46.2, void: 82.4 }[theme];
    const g = c.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.5, c.currentTime + 2); g.connect(this.musicBus);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 4; f.connect(g); this.filt = f;
    const oscs: OscillatorNode[] = [];
    [[1, 'sawtooth', 0], [1.005, 'sawtooth', 0], [0.5, 'sine', 0], [theme === 'exception' || theme === 'boss' ? 1.4983 : 1.5, 'triangle', 0]].forEach(([m, t]) => { const o = c.createOscillator(); o.type = t as OscillatorType; o.frequency.value = base * (m as number); const og = c.createGain(); og.gain.value = t === 'sine' ? .5 : .16; o.connect(og); og.connect(f); o.start(); oscs.push(o); });
    const lfo = c.createOscillator(); lfo.frequency.value = theme === 'boss' ? .35 : .12; const lg = c.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); this.lfoGain = lg;
    // machinery: low rumble + irregular thumps
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 120; const ng = c.createGain(); ng.gain.value = theme === 'root' ? .22 : .12; n.connect(nf); nf.connect(ng); ng.connect(g); n.start();
    let alive = true;
    const thump = () => { if (!alive || !this.ctx) return; if (this.ctx.state === 'running') { this.tone(base * .5, .5, 'sine', .22 + this.tension * .15, base * .25, 0, this.musicBus); if (theme === 'root') this.noise(.05, 3000, .03, 3, 'bandpass'); } setTimeout(thump, (theme === 'boss' ? 1100 : 2600 - this.tension * 1400) + Math.random() * 1200); };
    setTimeout(thump, 800);
    this.droneNodes = { stop: () => { alive = false; g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, .3); setTimeout(() => { oscs.forEach(o => o.stop()); lfo.stop(); n.stop(); g.disconnect(); }, 1500); } };
  }
  setTension(t: number) { this.tension = t; if (this.filt && this.ctx) this.filt.frequency.setTargetAtTime(220 + t * 900, this.ctx.currentTime, .5); }
  stopDrone() { this.droneNodes?.stop(); this.droneNodes = null; this.droneTheme = ''; }
}
export const audio = new AudioEngine();
