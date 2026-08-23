import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioNode,
  AudioParam,
  BiquadFilterNode,
  ConvolverNode,
  DelayNode,
  GainNode,
  OfflineAudioContext,
  OscillatorNode,
} from "node-web-audio-api";

// The one bridge between the vendored recipe player and a terminal.
//
// synth.ts's renderPatch takes a BaseAudioContext, and the whole player addresses Web Audio
// by global name - constructing an OfflineAudioContext, and testing `instanceof
// OscillatorNode` to decide whether a source can be detuned. Supplying those globals IS the
// port: every vendored audio source stays byte-identical to upstream, so a headless render
// is by construction the same node graph a browser builds.
//
// Assigned once on import, and never over a real implementation: a runtime that already has
// Web Audio (a browser, a future Bun) keeps its own.
const g = globalThis as unknown as Record<string, unknown>;

const HOST: Record<string, unknown> = {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioNode,
  AudioParam,
  BiquadFilterNode,
  ConvolverNode,
  DelayNode,
  GainNode,
  OfflineAudioContext,
  OscillatorNode,
};

for (const [name, impl] of Object.entries(HOST)) g[name] ??= impl;
