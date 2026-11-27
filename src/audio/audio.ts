"use client";
/**
 * Lab sound engine (Web Audio, everything synthesised — no sample files):
 *  - mechanical foley: banana plug in/out, knob detents, rocker switch, button, scope beep
 *  - ambience: fluorescent-ballast hum, room tone, transformer hum when the trainer is on
 *  - the KL-21001 loudspeaker plays the simulated voltage across its terminals
 */
import { useBench } from "@/store/bench";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { trafo: GainNode } | null = null;
let spk: { src: AudioBufferSourceNode | null; gain: GainNode; key: string } | null = null;

function enabled() {
  return useBench.getState().sound;
}

export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled() ? 1 : 0;
    master.connect(ctx.destination);
    startAmbience();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(muted: boolean) {
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function startAmbience() {
  if (!ctx || !master || ambience) return;
  const c = ctx;
  // KL-21001 mains transformer hum (only when powered)
  const trafo = c.createGain();
  trafo.gain.value = 0;
  for (const [f, a] of [
    [100, 1],
    [200, 0.5],
    [400, 0.15],
  ]) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = a;
    o.connect(g).connect(trafo);
    o.start();
  }
  trafo.connect(master);
  ambience = { trafo };
}

export function setTrainerPowered(on: boolean) {
  if (!ctx || !ambience) return;
  ambience.trafo.gain.setTargetAtTime(on ? 0.01 : 0, ctx.currentTime, 0.2);
}

type Sfx = "plug" | "unplug" | "clip" | "tick" | "switch" | "button" | "beep" | "dial";

/** short synthesised mechanical sounds */
export function sfx(kind: Sfx) {
  if (!enabled()) return;
  const c = audioContext();
  if (!c || !master) return;
  const t = c.currentTime;
  const out = c.createGain();
  out.connect(master);
  const burst = (dur: number, freq: number, q: number, gain: number, at = 0) => {
    const s = c.createBufferSource();
    s.buffer = noiseBuffer(c, dur);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    s.connect(bp).connect(g).connect(out);
    s.start(t + at);
  };
  const tone = (f: number, dur: number, gain: number, at = 0, type: OscillatorType = "sine") => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(gain, t + at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(g).connect(out);
    o.start(t + at);
    o.stop(t + at + dur + 0.02);
  };
  switch (kind) {
    case "plug": // friction slide + metal seat
      burst(0.05, 2600, 1.2, 0.25);
      burst(0.025, 5200, 4, 0.35, 0.045);
      tone(1900, 0.03, 0.05, 0.045, "triangle");
      break;
    case "unplug":
      burst(0.06, 2200, 1.0, 0.22);
      burst(0.02, 4300, 3, 0.2, 0.05);
      break;
    case "clip":
      burst(0.018, 3800, 5, 0.3);
      tone(2600, 0.02, 0.05, 0.004, "square");
      break;
    case "tick":
      burst(0.012, 3400, 6, 0.12);
      break;
    case "dial":
      burst(0.02, 2400, 4, 0.25);
      burst(0.015, 4100, 6, 0.18, 0.018);
      break;
    case "switch": // rocker thunk + relay
      burst(0.08, 600, 0.8, 0.5);
      burst(0.02, 3500, 4, 0.3, 0.005);
      burst(0.03, 1800, 3, 0.2, 0.09);
      break;
    case "button":
      burst(0.015, 3000, 3, 0.15);
      break;
    case "beep":
      tone(2730, 0.09, 0.08, 0, "square");
      break;
  }
}

/**
 * Feed the loudspeaker with one acquisition of the simulated speaker voltage.
 * An integer number of periods is looped seamlessly; loudness follows the
 * electrical power delivered into the 8 Ω speaker.
 */
export function updateSpeaker(t: Float64Array | null, v: Float64Array | null, period: number) {
  const c = ctx;
  if (!c || !master) return;
  if (!spk) {
    const gain = c.createGain();
    gain.gain.value = 0;
    // small speaker: band-limited
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 160;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 7000;
    gain.connect(hp).connect(lp).connect(master);
    spk = { src: null, gain, key: "" };
  }
  const s = spk;
  if (!t || !v || t.length < 8 || !(period > 0) || period > 0.1) {
    s.gain.gain.setTargetAtTime(0, c.currentTime, 0.05);
    return;
  }
  // signal power -> loudness
  let rms = 0;
  for (let i = 0; i < v.length; i++) rms += v[i] * v[i];
  rms = Math.sqrt(rms / v.length);
  const watts = (rms * rms) / 8;
  const loud = Math.min(0.5, Math.sqrt(watts) * 0.9);
  const key = `${period.toFixed(7)}|${v.length}|${rms.toFixed(3)}`;
  if (key !== s.key) {
    s.key = key;
    const T = t[t.length - 1] - t[0];
    const nPer = Math.max(1, Math.floor(T / period));
    const span = nPer * period;
    const sr = c.sampleRate;
    const n = Math.max(32, Math.round(span * sr));
    const buf = c.createBuffer(1, n, sr);
    const out = buf.getChannelData(0);
    const peak = Math.max(1e-6, ...Array.from(v, (x) => Math.abs(x)));
    let j = 0;
    for (let i = 0; i < n; i++) {
      const tt = t[0] + (i / n) * span;
      while (j < t.length - 2 && t[j + 1] < tt) j++;
      const f = (tt - t[j]) / (t[j + 1] - t[j] || 1);
      out[i] = (v[j] + (v[j + 1] - v[j]) * f) / peak;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(s.gain);
    src.start();
    s.src?.stop(c.currentTime + 0.03);
    s.src = src;
  }
  s.gain.gain.setTargetAtTime(enabled() ? loud : 0, c.currentTime, 0.05);
}

/** unlock audio on the first user gesture (browser autoplay policy) */
let installed = false;
export function installAudioUnlock() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const unlock = () => {
    audioContext();
    setTrainerPowered(useBench.getState().power);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  const knobAcc: Record<string, number> = {};
  useBench.subscribe((s, p) => {
    if (s.sound !== p.sound) setMuted(!s.sound);
    if (s.power !== p.power) {
      setTrainerPowered(s.power);
      sfx("switch");
    }
    // foley follows what happens on the bench
    if (s.wires.length > p.wires.length) sfx(s.wires[s.wires.length - 1]?.kind === "clip" ? "clip" : "plug");
    else if (s.wires.length < p.wires.length) sfx("unplug");
    for (const k of Object.keys(s.leads) as (keyof typeof s.leads)[]) {
      if (s.leads[k] && s.leads[k] !== p.leads[k]) sfx("clip");
    }
    if (s.dmmMode !== p.dmmMode) sfx("dial");
    if (s.knobs !== p.knobs) {
      for (const k of Object.keys(s.knobs)) {
        const d = Math.abs((s.knobs[k] ?? 0) - (p.knobs[k] ?? 0));
        if (!d) continue;
        if (k === "fg.func" || k === "fg.range" || k === "dvm.sel") sfx("dial");
        else {
          knobAcc[k] = (knobAcc[k] ?? 0) + d;
          if (knobAcc[k] > 0.025) {
            knobAcc[k] = 0;
            sfx("tick");
          }
        }
      }
    }
  });
}
