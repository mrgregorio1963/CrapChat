/**
 * CrapChat app entry — Throne Room, call, flush, silencer, reactions.
 */
import { SPLASH_MESSAGES, TOASTS, pick } from './humor.js?v=8';
import {
  initBackground,
  getAllScenes,
  selectBackground,
  uploadCustomBackground,
  removeAllCustoms,
  CATEGORIES,
  getCurrentBackgroundId,
} from './backgrounds.js?v=8';
import {
  getSavedName,
  setSavedName,
  getSilencerPref,
  setSilencerPref,
} from './storage.js?v=8';
import { initSegmentation, forceFallback, onSegmentationMode, startCompositor, stopCompositor, getCompositorStream } from './segmentation.js?v=8';
import {
  getMicStream,
  setSilencer,
  isSilencerOn,
  stopAudio,
  getAudioOutboundStream,
  setFlushAutoDetect,
} from './audio.js?v=8';
import { CallSession } from './webrtc.js?v=8';
import { playFlushSound, playPop, playToggle } from './sounds.js?v=8';
import { createHoldMusicStream, stopHoldMusic } from './holdmusic.js?v=8';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  view: 'home',
  roomId: null,
  name: '',
  localVideoStream: null, // raw camera
  micMuted: false,
  camMuted: false,
  category: 'all',
  session: null,
  socket: null,
  sitStarted: null,
  sitTimerInterval: null,
  peers: new Map(),
  onHold: false,
  holdPreviewOnly: false,
};

/* ---------- Toast / splash ---------- */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function showSplash() {
  const splash = $('#splash');
  const msg = $('#splash-msg');
  let i = 0;
  msg.textContent = SPLASH_MESSAGES[0];
  const iv = setInterval(() => {
    i = (i + 1) % SPLASH_MESSAGES.length;
    msg.textContent = SPLASH_MESSAGES[i];
  }, 700);
  return () => {
    clearInterval(iv);
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 500);
  };
}

function showView(name) {
  state.view = name;
  $$('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${name}`)?.classList.add('active');
  const timer = $('#sit-timer');
  const badge = $('#room-badge');
  if (name === 'call') {
    timer.classList.remove('hidden');
    badge.classList.remove('hidden');
  } else {
    timer.classList.add('hidden');
    if (name !== 'throne') badge.classList.add('hidden');
  }
}

/* ---------- Background UI ---------- */
async function renderBgGrid(container, { compact = false } = {}) {
  const scenes = await getAllScenes();
  const filtered =
    state.category === 'all'
      ? scenes.filter((s) => s.category !== 'custom').concat(scenes.filter((s) => s.category === 'custom'))
      : scenes.filter((s) => s.category === state.category);
  const current = getCurrentBackgroundId();
  container.innerHTML = '';
  for (const scene of filtered) {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'bg-thumb' + (scene.id === current ? ' selected' : '');
    thumb.setAttribute('role', 'option');
    thumb.dataset.id = scene.id;
    const img = document.createElement('img');
    img.alt = scene.name;
    img.loading = 'lazy';
    if (scene.file) img.src = `/assets/backgrounds/${scene.file}`;
    else if (scene.blob) img.src = URL.createObjectURL(scene.blob);
    thumb.appendChild(img);
    const label = document.createElement('span');
    label.className = 'bg-name';
    label.textContent = scene.name;
    thumb.appendChild(label);
    thumb.addEventListener('click', async () => {
      await selectBackground(scene.id);
      container.querySelectorAll('.bg-thumb').forEach((t) => t.classList.remove('selected'));
      thumb.classList.add('selected');
      // sync other grids
      $$('.bg-thumb').forEach((t) => {
        t.classList.toggle('selected', t.dataset.id === scene.id);
      });
      playPop();
    });
    container.appendChild(thumb);
  }
}

function renderCategories() {
  const row = $('#bg-categories');
  row.innerHTML = '';
  for (const c of CATEGORIES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (state.category === c.id ? ' active' : '');
    chip.textContent = c.label;
    chip.addEventListener('click', async () => {
      state.category = c.id;
      renderCategories();
      await renderBgGrid($('#bg-grid'));
    });
    row.appendChild(chip);
  }
}

/* ---------- Media / Throne ---------- */
async function ensureLocalMedia() {
  if (state.localVideoStream) return;
  const videoStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  state.localVideoStream = videoStream;
  const video = $('#local-video-raw');
  video.srcObject = videoStream;
  await video.play().catch(() => {});
  $('#preview-placeholder').classList.add('hidden');

  const silencer = getSilencerPref();
  await getMicStream({ silencer });
  syncSilencerButtons(silencer);

  const previewCanvas = $('#preview-canvas');
  startCompositor(video, previewCanvas);
}

function syncSilencerButtons(on) {
  for (const btn of [$('#btn-fart-silencer'), $('#btn-fart-call')]) {
    if (!btn) continue;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const st = btn.querySelector('.toggle-state');
    if (st) st.textContent = on ? 'ON' : 'OFF';
  }
}

async function toggleSilencer() {
  const next = !isSilencerOn();
  playToggle();
  const stream = await setSilencer(next);
  setSilencerPref(next);
  syncSilencerButtons(next);
  toast(pick(next ? TOASTS.silencerOn : TOASTS.silencerOff), next ? 'mint' : '');
  if (state.session) {
    const track = stream.getAudioTracks()[0];
    await state.session.replaceTrack('audio', state.micMuted ? null : track);
  }
}

function setMicMuted(muted) {
  state.micMuted = muted;
  const audio = getAudioOutboundStream();
  audio?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  $('#btn-mute')?.setAttribute('aria-pressed', muted ? 'true' : 'false');
  $('#btn-mute-preview')?.setAttribute('aria-pressed', muted ? 'true' : 'false');
  const st = $('#btn-mute-preview')?.querySelector('.toggle-state');
  if (st) st.textContent = muted ? 'OFF' : 'ON';
  $('#btn-mute').textContent = muted ? '🔇' : '🎤';
}

function setCamMuted(muted) {
  state.camMuted = muted;
  state.localVideoStream?.getVideoTracks().forEach((t) => { t.enabled = !muted; });
  $('#btn-cam')?.setAttribute('aria-pressed', muted ? 'true' : 'false');
  $('#btn-cam-preview')?.setAttribute('aria-pressed', muted ? 'true' : 'false');
  const st = $('#btn-cam-preview')?.querySelector('.toggle-state');
  if (st) st.textContent = muted ? 'OFF' : 'ON';
  $('#btn-cam').textContent = muted ? '🚫' : '📹';
}

function syncHoldButtons(on) {
  for (const id of ['#btn-hold', '#btn-hold-preview']) {
    const btn = $(id);
    if (!btn) continue;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const st = btn.querySelector('.toggle-state');
    if (st) st.textContent = on ? 'ON' : 'OFF';
  }
  const badge = $('#local-hold-badge');
  if (badge) badge.classList.toggle('hidden', !on);
}

async function setOnHold(on, { previewOnly = false } = {}) {
  state.onHold = !!on;
  state.holdPreviewOnly = !!previewOnly && !!on;
  syncHoldButtons(state.onHold);
  playToggle();

  if (state.onHold) {
    // Silence real mic tracks
    const mic = getAudioOutboundStream();
    mic?.getAudioTracks().forEach((tr) => { tr.enabled = false; });
    const musicStream = createHoldMusicStream();
    if (state.session && !previewOnly) {
      const track = musicStream.getAudioTracks()[0];
      await state.session.replaceTrack('audio', track);
      state.session.sendHold(true);
    }
    toast(pick(TOASTS.holdOn), 'gold');
  } else {
    stopHoldMusic();
    const mic = getAudioOutboundStream();
    mic?.getAudioTracks().forEach((tr) => { tr.enabled = !state.micMuted; });
    if (state.session) {
      const track = mic?.getAudioTracks()?.[0] || null;
      await state.session.replaceTrack('audio', state.micMuted ? null : track);
      state.session.sendHold(false);
    }
    toast(pick(TOASTS.holdOff), 'mint');
  }
}

async function toggleHold() {
  await setOnHold(!state.onHold, { previewOnly: state.view !== 'call' });
}

/* ---------- Room helpers ---------- */
function roomIdFromUrl() {
  const m = location.pathname.match(/\/room\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1].toLowerCase();
  const q = new URLSearchParams(location.search).get('room');
  return q ? q.toLowerCase() : null;
}

function setRoomUrl(roomId) {
  const url = `/room/${roomId}`;
  history.replaceState({}, '', url);
  $('#room-badge').textContent = `🚪 ${roomId}`;
  $('#invite-code-display').textContent = roomId;
}

async function createRoom() {
  const res = await fetch('/api/rooms', { method: 'POST' });
  const data = await res.json();
  return data.roomId;
}

function buildOutboundStream() {
  const canvasStream = getCompositorStream();
  const audioStream = getAudioOutboundStream();
  const out = new MediaStream();
  canvasStream?.getVideoTracks().forEach((t) => out.addTrack(t));
  audioStream?.getAudioTracks().forEach((t) => out.addTrack(t));
  return out;
}

/* ---------- Call UI ---------- */
function clearRemoteGrid() {
  $('#remote-grid').innerHTML = '';
  $('#remote-grid').dataset.count = '0';
  state.peers.clear();
}

function upsertRemote(peerId, stream, name) {
  let tile = document.getElementById(`peer-${peerId}`);
  if (!tile) {
    tile = document.createElement('div');
    tile.className = 'remote-tile';
    tile.id = `peer-${peerId}`;
    const v = document.createElement('video');
    v.playsInline = true;
    v.autoplay = true;
    tile.appendChild(v);
    const label = document.createElement('span');
    label.className = 'peer-name';
    label.textContent = name || 'Peer';
    tile.appendChild(label);
    const hold = document.createElement('div');
    hold.className = 'hold-banner hidden';
    hold.textContent = 'Please hold, your call is important';
    tile.appendChild(hold);
    $('#remote-grid').appendChild(tile);
  }
  const video = tile.querySelector('video');
  video.srcObject = stream;
  tile.querySelector('.peer-name').textContent = name || 'Peer';
  const prev = state.peers.get(peerId);
  state.peers.set(peerId, { stream, name, onHold: prev?.onHold || false });
  setPeerHoldUI(peerId, state.peers.get(peerId).onHold);
  $('#remote-grid').dataset.count = String(state.peers.size);
}

function setPeerHoldUI(peerId, on) {
  const tile = document.getElementById(`peer-${peerId}`);
  if (!tile) return;
  tile.querySelector('.hold-banner')?.classList.toggle('hidden', !on);
  const peer = state.peers.get(peerId);
  if (peer) peer.onHold = !!on;
}

function removeRemote(peerId) {
  document.getElementById(`peer-${peerId}`)?.remove();
  state.peers.delete(peerId);
  $('#remote-grid').dataset.count = String(state.peers.size);
}

function spawnReaction(emoji) {
  const layer = $('#reactions-layer');
  // ensure layer is positioned relative to videos
  const videos = $('#videos');
  if (getComputedStyle(videos).position === 'static') videos.style.position = 'relative';
  if (!layer.parentElement || layer.parentElement !== videos) {
    videos.appendChild(layer);
  }
  const bubble = document.createElement('div');
  bubble.className = 'reaction-bubble';
  bubble.textContent = emoji;
  bubble.style.left = 20 + Math.random() * 60 + '%';
  bubble.style.bottom = '10%';
  layer.appendChild(bubble);
  setTimeout(() => bubble.remove(), 2000);
}

function startSitTimer() {
  state.sitStarted = Date.now();
  const el = $('#sit-timer');
  const tick = () => {
    const s = Math.floor((Date.now() - state.sitStarted) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    el.textContent = `⏱️ ${mm}:${ss}`;
  };
  tick();
  state.sitTimerInterval = setInterval(tick, 1000);
}

function stopSitTimer() {
  clearInterval(state.sitTimerInterval);
  state.sitTimerInterval = null;
}

async function emergencyFlush() {
  playFlushSound();
  const overlay = $('#flush-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 1000);

  await selectBackground('business-office');
  $$('.bg-thumb').forEach((t) => t.classList.toggle('selected', t.dataset.id === 'business-office'));
  setMicMuted(true);
  toast(pick(TOASTS.flush), 'danger');
}

async function hangup() {
  playFlushSound();
  const overlay = $('#flush-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 900);

  if (state.onHold) {
    state.onHold = false;
    stopHoldMusic();
    syncHoldButtons(false);
  }
  state.session?.leave();
  state.session = null;
  stopSitTimer();
  clearRemoteGrid();
  toast(pick(TOASTS.hangup), 'gold');

  // Stay in throne with preview still running
  stopCompositor();
  const video = $('#local-video-raw');
  if (video?.srcObject) {
    startCompositor(video, $('#preview-canvas'));
    $('#preview-placeholder').classList.add('hidden');
  }
  showView('throne');
  history.replaceState({}, '', '/');
  $('#room-badge').classList.add('hidden');
}

async function enterCall(roomId) {
  state.roomId = roomId;
  state.name = ($('#display-name').value || '').trim() || getSavedName() || `Sitter-${Math.random().toString(36).slice(2, 6)}`;
  setSavedName(state.name);
  $('#display-name').value = state.name;

  await ensureLocalMedia();

  // Switch compositor output to call canvas (mirror same video element)
  stopCompositor();
  const callCanvas = $('#call-canvas');
  const video = $('#local-video-raw');
  startCompositor(video, callCanvas);

  const localStream = buildOutboundStream();

  if (!state.socket) {
    state.socket = io({ transports: ['websocket', 'polling'] });
  }

  const session = new CallSession({
    socket: state.socket,
    roomId,
    name: state.name,
    localStream,
    onPeerStream: (id, stream, name) => upsertRemote(id, stream, name),
    onPeerLeft: (id) => {
      removeRemote(id);
      toast(pick(TOASTS.peerLeft));
    },
    onPeerJoined: (id, name) => toast(pick(TOASTS.peerJoined) + ` (${name})`, 'mint'),
    onReaction: (emoji) => spawnReaction(emoji),
    onHold: (on, from) => {
      setPeerHoldUI(from, on);
      if (on) toast('Peer put you on hold. Elevator loading…', 'gold');
      else toast('Peer is back live.', 'mint');
    },
    onError: (m) => toast(m, 'danger'),
  });

  try {
    await session.join();
  } catch (e) {
    toast(e.message || 'Could not join room', 'danger');
    showView('throne');
    return;
  }

  state.session = session;
  setRoomUrl(roomId);
  showView('call');
  startSitTimer();
  toast(pick(TOASTS.joined), 'gold');

  setFlushAutoDetect(true, () => {
    emergencyFlush();
    toast('Auto-detected a flush-level boom. Stealth engaged.', 'danger');
  });
}

/* ---------- Wire UI ---------- */
function wire() {
  $('#brand-home').addEventListener('click', () => {
    if (state.view === 'call') return;
    showView('home');
  });

  $('#btn-create').addEventListener('click', async () => {
    const name = ($('#display-name').value || '').trim();
    if (name) setSavedName(name);
    showView('throne');
    try {
      await ensureLocalMedia();
    } catch (e) {
      toast('Camera permission needed for the Throne Room', 'danger');
      console.error(e);
    }
    state.pendingAction = 'create';
  });

  $('#btn-join').addEventListener('click', async () => {
    const code = ($('#room-code').value || '').trim().toLowerCase();
    if (!code) return toast('Enter a room code', 'danger');
    const name = ($('#display-name').value || '').trim();
    if (name) setSavedName(name);
    showView('throne');
    try {
      await ensureLocalMedia();
    } catch (e) {
      toast('Camera permission needed', 'danger');
    }
    state.pendingRoom = code;
    state.pendingAction = 'join';
  });

  $('#btn-back-home').addEventListener('click', () => showView('home'));

  $('#btn-enter-call').addEventListener('click', async () => {
    let roomId = state.pendingRoom;
    if (state.pendingAction === 'create' || !roomId) {
      roomId = await createRoom();
    }
    state.pendingRoom = null;
    state.pendingAction = null;
    await enterCall(roomId);
  });

  $('#btn-fart-silencer').addEventListener('click', () => toggleSilencer());
  $('#btn-fart-call').addEventListener('click', () => toggleSilencer());
  $('#btn-hold-preview')?.addEventListener('click', () => toggleHold());
  $('#btn-hold')?.addEventListener('click', () => toggleHold());

  $('#btn-mute-preview').addEventListener('click', () => setMicMuted(!state.micMuted));
  $('#btn-cam-preview').addEventListener('click', () => setCamMuted(!state.camMuted));
  $('#btn-mute').addEventListener('click', () => setMicMuted(!state.micMuted));
  $('#btn-cam').addEventListener('click', () => setCamMuted(!state.camMuted));

  $('#btn-flush').addEventListener('click', () => emergencyFlush());
  $('#btn-hangup').addEventListener('click', () => hangup());

  $('#btn-copy-invite').addEventListener('click', async () => {
    const link = location.origin + '/room/' + state.roomId;
    try {
      await navigator.clipboard.writeText(link);
      toast(pick(TOASTS.copy), 'mint');
    } catch {
      toast(link, 'gold');
    }
  });

  $('#btn-react').addEventListener('click', () => {
    $('#bg-sheet').classList.add('hidden');
    $('#react-sheet').classList.toggle('hidden');
  });
  $('#btn-bg-call').addEventListener('click', async () => {
    $('#react-sheet').classList.add('hidden');
    $('#bg-sheet').classList.toggle('hidden');
    await renderBgGrid($('#bg-grid-call'), { compact: true });
  });

  $('#react-sheet').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-emoji]');
    if (!btn) return;
    const emoji = btn.dataset.emoji;
    spawnReaction(emoji);
    state.session?.sendReaction(emoji);
    playPop();
    $('#react-sheet').classList.add('hidden');
  });

  $('#bg-upload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadCustomBackground(file);
    toast(pick(TOASTS.customBg), 'mint');
    $('#btn-clear-custom').classList.remove('hidden');
    state.category = 'custom';
    renderCategories();
    await renderBgGrid($('#bg-grid'));
    e.target.value = '';
  });

  $('#btn-clear-custom').addEventListener('click', async () => {
    await removeAllCustoms();
    await renderBgGrid($('#bg-grid'));
    toast('Custom backgrounds cleared');
  });
}

/* ---------- Boot ---------- */
async function boot() {
  const hideSplash = showSplash();
  $('#display-name').value = getSavedName();
  syncSilencerButtons(getSilencerPref());

  wire();
  renderCategories();

  try {
    await initBackground();
    await renderBgGrid($('#bg-grid'));
  } catch (e) {
    console.warn(e);
  }

  // Never let the AI background model block startup (can hang on iOS/slow networks)
  onSegmentationMode(({ fallback }) => {
    const badge = document.getElementById('basic-mode-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', !fallback);
  });

  // Give slow phones time to load self-hosted MediaPipe before falling back
  const segResult = await Promise.race([
    initSegmentation().catch((e) => { console.warn(e); return false; }),
    new Promise((r) => setTimeout(() => r('timeout'), 15000)),
  ]);
  if (segResult === 'timeout') forceFallback();

  const deep = roomIdFromUrl();
  hideSplash();

  if (deep) {
    state.pendingRoom = deep;
    state.pendingAction = 'join';
    $('#room-code').value = deep;
    showView('throne');
    try {
      await ensureLocalMedia();
    } catch (e) {
      toast('Allow camera to continue', 'danger');
    }
  } else {
    showView('home');
  }
}

setTimeout(() => { const sp = document.getElementById('splash'); if (sp) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 500); if (!document.querySelector('.view.active')) showView('home'); } }, 12000);
boot().catch((e) => {
  const sp = document.getElementById('splash'); if (sp) sp.remove(); showView('home');
  console.error(e);
  toast('Startup hiccup: ' + e.message, 'danger');
});
