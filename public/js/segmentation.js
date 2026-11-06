/**
 * Person segmentation + canvas compositing.
 *
 * Mask pipeline (MediaPipe):
 *  1) motion-adaptive temporal smooth (track fast motion; calm small jitter)
 *  2) hard threshold — confidence >~0.25 → person
 *  3) tiny interior close, then slight erode (prefer trimming real-room fringe
 *     over a halo). Hole-fill stays interior-only.
 *  4) 1px feather; re-clamp face interior to fully opaque
 *
 * MediaPipe assets are self-hosted under /vendor/mediapipe/selfie_segmentation.
 */
import { drawBackgroundCover, getCurrentBackgroundImage } from './backgrounds.js?v=8';

const VENDOR_BASE = '/vendor/mediapipe/selfie_segmentation';

let selfieSegmentation = null;
let ready = false;
let useFallback = false;
let fallbackLocked = false;
let videoEl = null;
let canvas = null;
let ctx = null;
let running = false;
let rafId = null;
let outputStream = null;
let lastProcess = 0;
let lastResultsAt = 0;
const PROCESS_EVERY_MS = 33;
let canvasW = 640;
let canvasH = 480;
let resizeObserver = null;
let modeListeners = [];

let rawMaskCanvas = null;
let rawMaskCtx = null;
let smoothMaskCanvas = null;
let smoothMaskCtx = null;
let workMaskCanvas = null;
let workMaskCtx = null;
let personCanvas = null;
let personCtx = null;
let hasSmoothMask = false;

/** Max EMA weight on previous frame when motion is near zero. */
const TEMPORAL_PREV_MAX = 0.05;
/** Delta (0–255) at which we fully trust the new mask (no lag). */
const MOTION_FULL_DELTA = 20;
/** Confidence below this → background (~0.25). */
const MASK_LO = 70;
/** Small blur for interior hole fill (keep tiny to avoid room halo). */
const FILL_BLUR_PX = 0;
/** After fill blur, keep alphas at/above this. */
const FILL_KEEP = 255;
/** Slight erode blur — trims real-room fringe at silhouette. */
const ERODE_RADIUS = 2;
/** After erode blur, keep only strong person alphas. */
const ERODE_KEEP = 255; // unused with binary erode
/** Edge feather. */
const FEATHER_BLUR_PX = 1.25;
const RESULTS_WATCHDOG_MS = 4000;

export function isSegmentationReady() {
  return ready;
}

export function isUsingFallback() {
  return useFallback || !selfieSegmentation;
}

export function onSegmentationMode(cb) {
  modeListeners.push(cb);
  try { cb({ fallback: isUsingFallback(), ready }); } catch (_) {}
  return () => {
    modeListeners = modeListeners.filter((f) => f !== cb);
  };
}

function emitMode() {
  const detail = { fallback: isUsingFallback(), ready };
  for (const cb of modeListeners) {
    try { cb(detail); } catch (_) {}
  }
  try {
    document.dispatchEvent(new CustomEvent('crapchat-seg-mode', { detail }));
  } catch (_) {}
}

export function forceFallback() {
  fallbackLocked = true;
  useFallback = true;
  ready = true;
  console.warn('[CrapChat] Forced soft-matte fallback');
  emitMode();
}

export async function initSegmentation() {
  try {
    await loadScript(`${VENDOR_BASE}/selfie_segmentation.js`);
    if (fallbackLocked) {
      ready = true;
      useFallback = true;
      emitMode();
      return false;
    }
    const SS = window.SelfieSegmentation;
    if (!SS) throw new Error('SelfieSegmentation global missing');

    selfieSegmentation = new SS({
      locateFile: (file) => `${VENDOR_BASE}/${file}`,
    });
    selfieSegmentation.setOptions({
      modelSelection: 0,
      selfieMode: true,
    });
    await selfieSegmentation.initialize?.();
    if (fallbackLocked) {
      ready = true;
      useFallback = true;
      emitMode();
      return false;
    }
    ready = true;
    useFallback = false;
    console.log('[CrapChat] MediaPipe Selfie Segmentation ready (vendor)');
    emitMode();
    return true;
  } catch (err) {
    console.warn('[CrapChat] Segmentation unavailable, using soft-matte fallback', err);
    useFallback = true;
    ready = true;
    emitMode();
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

function ensureAuxCanvases(vw, vh) {
  const need = (c) => !c || c.width !== vw || c.height !== vh;
  if (need(rawMaskCanvas)) {
    rawMaskCanvas = document.createElement('canvas');
    rawMaskCanvas.width = vw;
    rawMaskCanvas.height = vh;
    rawMaskCtx = rawMaskCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (need(smoothMaskCanvas)) {
    smoothMaskCanvas = document.createElement('canvas');
    smoothMaskCanvas.width = vw;
    smoothMaskCanvas.height = vh;
    smoothMaskCtx = smoothMaskCanvas.getContext('2d', { willReadFrequently: true });
    hasSmoothMask = false;
  }
  if (need(workMaskCanvas)) {
    workMaskCanvas = document.createElement('canvas');
    workMaskCanvas.width = vw;
    workMaskCanvas.height = vh;
    workMaskCtx = workMaskCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (need(personCanvas)) {
    personCanvas = document.createElement('canvas');
    personCanvas.width = vw;
    personCanvas.height = vh;
    personCtx = personCanvas.getContext('2d');
  }
}

function syncCanvasToVideo() {
  if (!videoEl || !canvas) return false;
  const vw = videoEl.videoWidth || 0;
  const vh = videoEl.videoHeight || 0;
  if (vw < 2 || vh < 2) return false;
  if (vw === canvasW && vh === canvasH && canvas.width === vw && canvas.height === vh) {
    return true;
  }
  canvasW = vw;
  canvasH = vh;
  canvas.width = vw;
  canvas.height = vh;
  ensureAuxCanvases(vw, vh);
  canvas.style.aspectRatio = `${vw} / ${vh}`;
  hasSmoothMask = false;
  return true;
}

export function startCompositor(video, outCanvas) {
  videoEl = video;
  canvas = outCanvas;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  running = true;
  hasSmoothMask = false;
  lastResultsAt = performance.now();
  syncCanvasToVideo();

  const onMeta = () => syncCanvasToVideo();
  videoEl.addEventListener('loadedmetadata', onMeta);
  videoEl.addEventListener('resize', onMeta);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => syncCanvasToVideo());
    try { resizeObserver.observe(videoEl); } catch (_) {}
  }

  const mpOk = ready && !useFallback && !fallbackLocked && selfieSegmentation;
  if (!mpOk) {
    useFallback = true;
    emitMode();
    loopFallback();
  } else {
    selfieSegmentation.onResults(onResults);
    loopMediapipe();
  }

  outputStream = canvas.captureStream(30);
  emitMode();
  return outputStream;
}

export function getCompositorStream() {
  return outputStream;
}

export function getCompositorSize() {
  return { width: canvasW, height: canvasH };
}

export function stopCompositor() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  outputStream?.getTracks().forEach((t) => t.stop());
  outputStream = null;
  hasSmoothMask = false;
}

function switchToFallback(reason) {
  if (useFallback) return;
  console.warn('[CrapChat] Switching to soft-matte:', reason);
  useFallback = true;
  emitMode();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  loopFallback();
}

function loopMediapipe() {
  const tick = async () => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (useFallback) return;
    if (!videoEl || videoEl.readyState < 2) return;
    if (performance.now() - lastResultsAt > RESULTS_WATCHDOG_MS) {
      switchToFallback('no MediaPipe results');
      return;
    }
    syncCanvasToVideo();
    const t = performance.now();
    if (t - lastProcess < PROCESS_EVERY_MS) return;
    lastProcess = t;
    try {
      await selfieSegmentation.send({ image: videoEl });
    } catch (e) {
      switchToFallback(e?.message || 'send failed');
    }
  };
  rafId = requestAnimationFrame(tick);
}

function readConfidence(d, i) {
  const a = d[i + 3];
  const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
  if (a < 250 && luma >= 250) return a;
  if (luma < 250 && a >= 250) return luma;
  return Math.max(a, luma);
}

/**
 * Motion-adaptive smooth + hard threshold + binary morph erode.
 * Binary erode (not blur) shrinks the silhouette by ERODE_RADIUS px so
 * soft MediaPipe fringes (real-room pixels) are cut away cleanly.
 */

/** Zero mask where the camera frame is vivid green/magenta real-room backdrop. */
function rejectBackdropFringe(image, W, H) {
  if (!image) return;
  // Sample camera into work buffer
  workMaskCtx.clearRect(0, 0, W, H);
  try { workMaskCtx.drawImage(image, 0, 0, W, H); } catch (_) { return; }
  const cam = workMaskCtx.getImageData(0, 0, W, H).data;
  const mask = rawMaskCtx.getImageData(0, 0, W, H);
  const d = mask.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = cam[i], g = cam[i + 1], b = cam[i + 2];
    const vividGreen = g > 120 && g > r + 40 && g > b + 40;
    const vividMagenta = r > 140 && b > 120 && g < 110 && r + b > 280;
    // Do NOT reject light/desaturated tones — that punches holes in pale skin.
    if (vividGreen || vividMagenta) {
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = 0;
    }
  }
  rawMaskCtx.putImageData(mask, 0, 0);
}

function refineMask(W, H) {
  ensureAuxCanvases(W, H);

  const neu = rawMaskCtx.getImageData(0, 0, W, H);
  const nd = neu.data;

  if (!hasSmoothMask || TEMPORAL_PREV_MAX <= 0) {
    for (let i = 0; i < nd.length; i += 4) {
      const v = readConfidence(nd, i);
      nd[i] = nd[i + 1] = nd[i + 2] = 255;
      nd[i + 3] = v;
    }
    smoothMaskCtx.putImageData(neu, 0, 0);
    hasSmoothMask = true;
  } else {
    const prev = smoothMaskCtx.getImageData(0, 0, W, H);
    const pd = prev.data;
    for (let i = 0; i < nd.length; i += 4) {
      const n = readConfidence(nd, i);
      const p = pd[i + 3];
      const delta = n > p ? n - p : p - n;
      let w = 0;
      if (delta < MOTION_FULL_DELTA) {
        w = TEMPORAL_PREV_MAX * (1 - delta / MOTION_FULL_DELTA);
      }
      const out = p * w + n * (1 - w);
      pd[i] = pd[i + 1] = pd[i + 2] = 255;
      pd[i + 3] = out;
    }
    smoothMaskCtx.putImageData(prev, 0, 0);
  }

  // Hard binary person mask
  let img = smoothMaskCtx.getImageData(0, 0, W, H);
  let d = img.data;
  const bin = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    bin[p] = d[i + 3] >= MASK_LO ? 1 : 0;
  }

  // Binary morphological CLOSE (dilate then erode 1px) to seal tiny face holes
  const closed = morphDilate(bin, W, H, 1);
  const sealed = morphErode(closed, W, H, 1);

  // Strong binary ERODE — strip real-room fringe that MediaPipe soft-includes
  const eroded = morphErode(sealed, W, H, ERODE_RADIUS);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = eroded[p] ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = a;
  }
  workMaskCtx.putImageData(img, 0, 0);

  // Inward feather: blur then multiply by hard eroded mask (never expands into room)
  if (FEATHER_BLUR_PX > 0) {
    const hard = workMaskCtx.getImageData(0, 0, W, H);
    rawMaskCtx.clearRect(0, 0, W, H);
    rawMaskCtx.filter = `blur(${FEATHER_BLUR_PX}px)`;
    rawMaskCtx.drawImage(workMaskCanvas, 0, 0);
    rawMaskCtx.filter = 'none';
    const soft = rawMaskCtx.getImageData(0, 0, W, H);
    const sd = soft.data, hd = hard.data;
    for (let i = 0; i < sd.length; i += 4) {
      let a = Math.round(sd[i + 3] * (hd[i + 3] / 255));
      if (a >= 230) a = 255;
      else if (a <= 20) a = 0;
      sd[i] = sd[i + 1] = sd[i + 2] = 255;
      sd[i + 3] = a;
    }
    workMaskCtx.putImageData(soft, 0, 0);
  }
}

function morphDilate(src, W, H, r) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && src[ny * W + nx]) { on = 1; break; }
        }
      }
      out[y * W + x] = on;
    }
  }
  return out;
}

function morphErode(src, W, H, r) {
  const out = new Uint8Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 1;
      for (let dy = -r; dy <= r && on; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || !src[ny * W + nx]) { on = 0; break; }
        }
      }
      out[y * W + x] = on;
    }
  }
  return out;
}


function onResults(results) {
  if (!ctx || !running || useFallback) return;
  lastResultsAt = performance.now();
  syncCanvasToVideo();
  const W = canvasW;
  const H = canvasH;
  ensureAuxCanvases(W, H);
  const bg = getCurrentBackgroundImage();
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackgroundCover(ctx, bg, W, H);

  if (results.segmentationMask) {
    rawMaskCtx.clearRect(0, 0, W, H);
    rawMaskCtx.drawImage(results.segmentationMask, 0, 0, W, H);
    // Reject camera pixels that are clearly the real-room chroma (green/magenta).
    // MediaPipe often soft-includes a thick fringe of the original backdrop.
    rejectBackdropFringe(results.image || videoEl, W, H);
    refineMask(W, H);

    personCtx.clearRect(0, 0, W, H);
    personCtx.globalCompositeOperation = 'source-over';
    personCtx.drawImage(results.image, 0, 0, W, H);
    personCtx.globalCompositeOperation = 'destination-in';
    personCtx.drawImage(workMaskCanvas, 0, 0);
    personCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(personCanvas, 0, 0);
  } else if (videoEl) {
    ctx.drawImage(videoEl, 0, 0, W, H);
  }
  ctx.restore();
}

function loopFallback() {
  const tick = () => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (!videoEl || videoEl.readyState < 2 || !ctx) return;
    syncCanvasToVideo();
    const W = canvasW;
    const H = canvasH;
    ensureAuxCanvases(W, H);
    const bg = getCurrentBackgroundImage();
    ctx.clearRect(0, 0, W, H);
    drawBackgroundCover(ctx, bg, W, H);

    personCtx.clearRect(0, 0, W, H);
    personCtx.globalCompositeOperation = 'source-over';
    personCtx.drawImage(videoEl, 0, 0, W, H);
    personCtx.globalCompositeOperation = 'destination-in';

    // Tighter oval than before — less room leak outside the person
    const g = personCtx.createRadialGradient(
      W * 0.5, H * 0.40, H * 0.10,
      W * 0.5, H * 0.45, H * 0.42
    );
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.78, 'rgba(0,0,0,1)');
    g.addColorStop(0.92, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    personCtx.fillStyle = g;
    personCtx.fillRect(0, 0, W, H);

    personCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(personCanvas, 0, 0);
  };
  rafId = requestAnimationFrame(tick);
}

export function resizeCompositor() {
  syncCanvasToVideo();
}
