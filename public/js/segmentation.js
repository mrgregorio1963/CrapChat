/**
 * Person segmentation + canvas compositing.
 * Canvas matches the camera's actual videoWidth/videoHeight so faces aren't stretched.
 *
 * Mask pipeline (MediaPipe):
 *  1) temporal EMA of the confidence mask (kills edge flicker)
 *  2) hard threshold — anything above ~0.25 confidence becomes person
 *  3) morphological close (dilate then erode) fills face holes, trims fringe
 *  4) tiny feather blur only at the silhouette edge
 *
 * MediaPipe mask may live in ALPHA and/or RGB; we read both. destination-in
 * uses source alpha, so the finished mask is white RGB with person in A.
 */
import { drawBackgroundCover, getCurrentBackgroundImage } from './backgrounds.js?v=6';

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

let rawMaskCanvas = null;
let rawMaskCtx = null;
let smoothMaskCanvas = null;
let smoothMaskCtx = null;
let workMaskCanvas = null;
let workMaskCtx = null;
let personCanvas = null;
let personCtx = null;
let hasSmoothMask = false;

/** Weight on previous mask. High = less flicker, a bit more lag. */
const TEMPORAL_PREV = 0.55;
/** Confidence below this → background. ~0.25 of 255. */
const MASK_LO = 64;
/** Blur radius for morphological close (dilate then erode). */
const CLOSE_BLUR_PX = 5;
/** After dilate blur, alphas at/above this become person. */
const DILATE_KEEP = 80;
/** After erode blur, alphas at/above this stay person (shrinks fringe). */
const ERODE_KEEP = 200;
/** Feather blur (px) for soft silhouette only. */
const FEATHER_BLUR_PX = 1.25;
/** If MediaPipe stops delivering results, fall back. */
const RESULTS_WATCHDOG_MS = 2500;

export function isSegmentationReady() {
  return ready;
}

export function isUsingFallback() {
  return useFallback || !selfieSegmentation;
}

/** Lock soft-matte path (e.g. init timed out on iOS). */
export function forceFallback() {
  fallbackLocked = true;
  useFallback = true;
  ready = true;
  console.warn('[CrapChat] Forced soft-matte fallback');
}

export async function initSegmentation() {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
    if (fallbackLocked) {
      ready = true;
      useFallback = true;
      return false;
    }
    const SS = window.SelfieSegmentation;
    if (!SS) throw new Error('SelfieSegmentation global missing');

    selfieSegmentation = new SS({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    selfieSegmentation.setOptions({
      modelSelection: 1,
      selfieMode: true,
    });
    await selfieSegmentation.initialize?.();
    if (fallbackLocked) {
      ready = true;
      useFallback = true;
      return false;
    }
    ready = true;
    useFallback = false;
    console.log('[CrapChat] MediaPipe Selfie Segmentation ready');
    return true;
  } catch (err) {
    console.warn('[CrapChat] Segmentation unavailable, using soft-matte fallback', err);
    useFallback = true;
    ready = true;
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
    loopFallback();
  } else {
    selfieSegmentation.onResults(onResults);
    loopMediapipe();
  }

  outputStream = canvas.captureStream(30);
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

/** Read person confidence 0–255 from either alpha-mask or RGB-mask layouts. */
function readConfidence(d, i) {
  const a = d[i + 3];
  const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
  // Alpha mask: RGB ~255, A = confidence. RGB mask: A ~255, RGB = confidence.
  if (a < 250 && luma >= 250) return a;
  if (luma < 250 && a >= 250) return luma;
  return Math.max(a, luma);
}

/**
 * Temporal EMA + morphological close (dilate→erode) + light feather.
 * Close fills face holes without leaving a thick original-bg halo.
 * Finished mask: RGB white, A = person (fully opaque interior).
 */
function refineMask(W, H) {
  ensureAuxCanvases(W, H);

  // 1) Temporal EMA on the raw confidence mask
  if (!hasSmoothMask) {
    smoothMaskCtx.globalAlpha = 1;
    smoothMaskCtx.globalCompositeOperation = 'source-over';
    smoothMaskCtx.clearRect(0, 0, W, H);
    smoothMaskCtx.drawImage(rawMaskCanvas, 0, 0);
    hasSmoothMask = true;
  } else {
    smoothMaskCtx.globalCompositeOperation = 'source-over';
    smoothMaskCtx.globalAlpha = 1 - TEMPORAL_PREV;
    smoothMaskCtx.drawImage(rawMaskCanvas, 0, 0);
    smoothMaskCtx.globalAlpha = 1;
  }

  // 2) Conservative binary from confidence (anything >~0.25 = person)
  let img = smoothMaskCtx.getImageData(0, 0, W, H);
  let d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = readConfidence(d, i) >= MASK_LO ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = v;
  }
  workMaskCtx.putImageData(img, 0, 0);

  // 3) Dilate: blur + low threshold → expands and fills interior holes
  rawMaskCtx.clearRect(0, 0, W, H);
  rawMaskCtx.filter = `blur(${CLOSE_BLUR_PX}px)`;
  rawMaskCtx.drawImage(workMaskCanvas, 0, 0);
  rawMaskCtx.filter = 'none';
  img = rawMaskCtx.getImageData(0, 0, W, H);
  d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3] >= DILATE_KEEP ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = v;
  }
  workMaskCtx.putImageData(img, 0, 0);

  // 4) Erode: blur + high threshold → shrinks fringe back (keeps filled holes)
  rawMaskCtx.clearRect(0, 0, W, H);
  rawMaskCtx.filter = `blur(${CLOSE_BLUR_PX}px)`;
  rawMaskCtx.drawImage(workMaskCanvas, 0, 0);
  rawMaskCtx.filter = 'none';
  img = rawMaskCtx.getImageData(0, 0, W, H);
  d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i + 3] >= ERODE_KEEP ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = v;
  }
  workMaskCtx.putImageData(img, 0, 0);

  // 5) Tiny edge feather; re-clamp interior to fully opaque
  if (FEATHER_BLUR_PX > 0) {
    rawMaskCtx.clearRect(0, 0, W, H);
    rawMaskCtx.filter = `blur(${FEATHER_BLUR_PX}px)`;
    rawMaskCtx.drawImage(workMaskCanvas, 0, 0);
    rawMaskCtx.filter = 'none';
    img = rawMaskCtx.getImageData(0, 0, W, H);
    d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let a = d[i + 3];
      if (a >= 200) a = 255;
      else if (a <= 16) a = 0;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = a;
    }
    workMaskCtx.putImageData(img, 0, 0);
  }
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

/**
 * Soft-matte fallback — solid opaque oval over torso/head, soft edge only.
 */
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

    // Large solid core so face never shows background through the middle
    const g = personCtx.createRadialGradient(
      W * 0.5, H * 0.40, H * 0.08,
      W * 0.5, H * 0.48, H * 0.52
    );
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.72, 'rgba(0,0,0,1)');
    g.addColorStop(0.88, 'rgba(0,0,0,0.7)');
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
