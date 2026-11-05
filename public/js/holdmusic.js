/**
 * Cheesy on-hold elevator music via Web Audio (no copyrighted files).
 * Mixes into an outbound MediaStream for remote peers.
 */

let ctx = null;
let masterGain = null;
let dest = null;
let playing = false;
let oscillators = [];
let intervals = [];

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Classic-ish elevator: slow waltz-y arpeggio in C major */
const MELODY = [
  // [midi, beats]
  [60, 1], [64, 1], [67, 1], [72, 1],
  [67, 1], [64, 1], [60, 1], [55, 1],
  [62, 1], [65, 1], [69, 1], [74, 1],
  [69, 1], [65, 1], [62, 1], [57, 1],
  [60, 1], [64, 1], [67, 1], [64, 1],
  [67, 2], [72, 2],
];

function midiToHz(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function startLoop() {
  const c = ac();
  dest = c.createMediaStreamDestination();
  masterGain = c.createGain();
  masterGain.gain.value = 0.22;
  masterGain.connect(dest);
  // Soft local monitor (very quiet)
  const monitor = c.createGain();
  monitor.gain.value = 0.04;
  masterGain.connect(monitor);
  monitor.connect(c.destination);

  // Gentle pad
  const pad = c.createOscillator();
  pad.type = 'sine';
  pad.frequency.value = midiToHz(48);
  const padGain = c.createGain();
  padGain.gain.value = 0.08;
  const padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  pad.connect(padFilter);
  padFilter.connect(padGain);
  padGain.connect(masterGain);
  pad.start();
  oscillators.push(pad);

  let step = 0;
  const beatMs = 420;
  const tick = () => {
    if (!playing) return;
    const [midi, beats] = MELODY[step % MELODY.length];
    step++;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(midi);
    const g = c.createGain();
    const now = c.currentTime;
    const dur = beats * (beatMs / 1000) * 0.9;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.05);
    oscillators.push(osc);
    // schedule next
    const id = setTimeout(tick, beats * beatMs);
    intervals.push(id);
  };
  playing = true;
  tick();
  return dest.stream;
}

function stopLoop() {
  playing = false;
  for (const id of intervals) clearTimeout(id);
  intervals = [];
  for (const o of oscillators) {
    try { o.stop(); } catch (_) {}
    try { o.disconnect(); } catch (_) {}
  }
  oscillators = [];
  try { masterGain?.disconnect(); } catch (_) {}
  masterGain = null;
  dest = null;
}

/**
 * Build outbound audio: either mic, or hold music (mic silenced).
 * @returns {{ stream: MediaStream, musicStream?: MediaStream }}
 */
export function createHoldMusicStream() {
  stopLoop();
  const music = startLoop();
  return music;
}

export function stopHoldMusic() {
  stopLoop();
}

export function isHoldMusicPlaying() {
  return playing;
}
