/** Procedural flush & UI sounds via Web Audio (no external assets required) */

let ctx;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playFlushSound() {
  const c = ac();
  const t0 = c.currentTime;
  // Whoosh noise burst
  const bufferSize = c.sampleRate * 0.9;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = Math.pow(1 - i / bufferSize, 1.5);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t0);
  filter.frequency.exponentialRampToValueAtTime(120, t0 + 0.8);
  filter.Q.value = 0.7;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.45, t0 + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  noise.start(t0);
  noise.stop(t0 + 0.9);

  // Gurgle oscillator
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.6);
  const og = c.createGain();
  og.gain.setValueAtTime(0.15, t0);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
  osc.connect(og);
  og.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.65);
}

export function playPop() {
  const c = ac();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.13);
}

export function playToggle() {
  const c = ac();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(440, t0);
  osc.frequency.setValueAtTime(660, t0 + 0.06);
  const g = c.createGain();
  g.gain.setValueAtTime(0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.16);
}
