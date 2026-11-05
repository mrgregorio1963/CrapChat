/**
 * Fart Silencer: getUserMedia noiseSuppression + Web Audio noise gate / filter chain.
 * Optional RNNoise path stubbed if wasm unavailable — chain still works.
 */

let audioCtx = null;
let sourceNode = null;
let gateGain = null;
let analyser = null;
let destNode = null;
let rawStream = null;
let processedStream = null;
let silencerOn = false;
let gateRaf = null;
let flushDetectOn = false;
let onFlushDetected = null;
let flushCooldownUntil = 0;

export function isSilencerOn() {
  return silencerOn;
}

export async function getMicStream({ silencer = false } = {}) {
  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: !!silencer,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  rawStream = stream;
  if (silencer) {
    processedStream = buildChain(stream, true);
    silencerOn = true;
    return processedStream;
  }
  silencerOn = false;
  processedStream = stream;
  return stream;
}

function ensureCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function buildChain(stream, withGate) {
  const ctx = ensureCtx();
  teardownChainNodes();

  sourceNode = ctx.createMediaStreamSource(stream);

  // Highpass to drop rumble / low bathroom resonance
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = withGate ? 120 : 80;
  highpass.Q.value = 0.7;

  // Gentle lowpass to tame hiss
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = withGate ? 5500 : 8000;

  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  gateGain = ctx.createGain();
  gateGain.gain.value = 1;

  destNode = ctx.createMediaStreamDestination();

  sourceNode.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(analyser);
  analyser.connect(gateGain);
  gateGain.connect(destNode);

  if (withGate) startGate();
  else stopGateLoop();

  // Keep original track settings; return processed audio track stream
  return destNode.stream;
}

function teardownChainNodes() {
  stopGateLoop();
  try { sourceNode?.disconnect(); } catch (_) {}
  try { gateGain?.disconnect(); } catch (_) {}
  try { analyser?.disconnect(); } catch (_) {}
  sourceNode = gateGain = analyser = destNode = null;
}

function startGate() {
  stopGateLoop();
  const data = new Float32Array(analyser.fftSize);
  const THRESH = 0.018;
  const ATTACK = 0.015;
  const RELEASE = 0.12;

  const tick = () => {
    if (!analyser || !gateGain) return;
    analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);

    const ctx = audioCtx;
    const target = rms > THRESH ? 1 : 0.02;
    const now = ctx.currentTime;
    const t = target > gateGain.gain.value ? ATTACK : RELEASE;
    gateGain.gain.cancelScheduledValues(now);
    gateGain.gain.setTargetAtTime(target, now, t);

    if (flushDetectOn && rms > 0.22 && Date.now() > flushCooldownUntil) {
      // Simple loud burst detector (flush-like)
      flushCooldownUntil = Date.now() + 8000;
      onFlushDetected?.();
    }

    gateRaf = requestAnimationFrame(tick);
  };
  gateRaf = requestAnimationFrame(tick);
}

function stopGateLoop() {
  if (gateRaf) cancelAnimationFrame(gateRaf);
  gateRaf = null;
}

/**
 * Toggle silencer; returns the stream that should be used for WebRTC.
 */
export async function setSilencer(on) {
  silencerOn = on;
  if (!rawStream) {
    return getMicStream({ silencer: on });
  }
  // Re-acquire with constraint when possible for OS-level NS
  try {
    const tracks = rawStream.getAudioTracks();
    for (const t of tracks) t.stop();
  } catch (_) {}
  return getMicStream({ silencer: on });
}

export function getAudioOutboundStream() {
  return processedStream || rawStream;
}

export function setFlushAutoDetect(enabled, cb) {
  flushDetectOn = enabled;
  onFlushDetected = cb;
}

export function stopAudio() {
  stopGateLoop();
  teardownChainNodes();
  rawStream?.getTracks().forEach((t) => t.stop());
  rawStream = processedStream = null;
  silencerOn = false;
}
