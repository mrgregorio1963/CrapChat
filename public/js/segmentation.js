/**
 * Person segmentation + canvas compositing.
 * Canvas matches the camera's actual videoWidth/videoHeight so faces aren't stretched.
 *
 * Mask pipeline (MediaPipe):
 *  1) temporal EMA of the segmentation mask (kills flicker)
 *  2) slight blur = soft dilation so hair/head edges aren't eaten
 *  3) contrast/threshold so the person interior is fully opaque
 *  4) tiny feather blur only at the silhouette edge
 */
import { drawBackgroundCover, getCurrentBackgroundImage } from './backgrounds.js';

let selfieSegmentation = null;
let ready = false;
let useFallback = false;
let videoEl = null;
let canvas = null;
let ctx = null;
let running = false;
let rafId = null;
let outputStream = null;
let lastProcess = 0;
const PROCESS_EVERY_MS = 33;
let canvasW = 640;
let canvasH = 480;
let resizeObserver = null;

/** Raw mask from MediaPipe this frame. */
let rawMaskCanvas = null;
let rawMaskCtx = null;
/** Temporally smoothed mask (persists across frames). */
let smoothMaskCanvas = null;
let smoothMaskCtx = null;
/** Work buffer for blur / threshold / feather. */
let workMaskCanvas = null;
let workMaskCtx = null;
/** Person cutout composite buffer (reused, not recreated each frame). */
let personCanvas = null;
let personCtx = null;
/** Whether smoothMask has a valid previous frame. */
let hasSmoothMask = false;

/** Weight on the previous mask (0.6–0.7). Higher = less flicker, more lag. */
const TEMPORAL_PREV = 0.68;
/** Mask values at/below this become fully transparent after contrast. */
const MASK_LO = 70;
/** Mask values at/above this become fully opaque after contrast. */
const MASK_HI = 165;
/** Blur radius (px) used as soft dilation before thresholding. */
const DILATE_BLUR_PX = 3;
/** Feather blur (px) applied after thresholding for soft silhouette edge. */
const FEATHER_BLUR_PX = 2;

export function isSegmentationReady() {
  return ready;
}

export async function initSegmentation() {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
    const SS = window.SelfieSegmentation;
    if (!SS) throw new Error('SelfieSegmentation global missing');

    selfieSegmentation = new SS({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    // modelSelection: 1 = general/landscape model — more stable for upper-body / head
    selfieSegmentation.setOptions({
      modelSelection: 1,
      selfieMode: true,
    });
    await selfieSegmentation.initialize?.();
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

/** Sync internal canvas size to the live camera frame (handles orientation). */
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
  // Hint CSS aspect via style so object-fit has the right intrinsic ratio
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
  syncCanvasToVideo();

  const onMeta = () => syncCanvasToVideo();
  videoEl.addEventListener('loadedmetadata', onMeta);
  videoEl.addEventListener('resize', onMeta);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(() => syncCanvasToVideo());
    try { resizeObserver.observe(videoEl); } catch (_) {}
  }

  if (useFallback || !selfieSegmentation) {
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

function loopMediapipe() {
  const tick = async () => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (!videoEl || videoEl.readyState < 2) return;
    syncCanvasToVideo();
    const t = performance.now();
    if (t - lastProcess < PROCESS_EVERY_MS) return;
    lastProcess = t;
    try {
      await selfieSegmentation.send({ image: videoEl });
    } catch (_) {}
  };
  rafId = requestAnimationFrame(tick);
}

/**
 * Temporal EMA + dilate + threshold + feather.
 * Writes the finished alpha mask into workMaskCanvas.
 */
function refineMask(W, H) {
  ensureAuxCanvases(W, H);

  // 1) Temporal blend: out = new*(1-α) + prev*α  via source-over
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

  // 2) Soft dilation: blur expands bright (person) regions so hair/head aren't eaten
  workMaskCtx.save();
  workMaskCtx.clearRect(0, 0, W, H);
  workMaskCtx.filter = `blur(${DILATE_BLUR_PX}px)`;
  workMaskCtx.drawImage(smoothMaskCanvas, 0, 0);
  workMaskCtx.filter = 'none';
  workMaskCtx.restore();

  // 3) Contrast / threshold — person interior snaps to fully opaque
  const img = workMaskCtx.getImageData(0, 0, W, H);
  const d = img.data;
  const span = MASK_HI - MASK_LO || 1;
  for (let i = 0; i < d.length; i += 4) {
    // MediaPipe mask is grayscale in RGB (person ≈ white)
    let v = d[i];
    if (v <= MASK_LO) v = 0;
    else if (v >= MASK_HI) v = 255;
    else v = ((v - MASK_LO) / span) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  workMaskCtx.putImageData(img, 0, 0);

  // 4) Tiny feather only at the silhouette edge
  if (FEATHER_BLUR_PX > 0) {
    // Draw blurred copy back onto itself via an intermediate pass on rawMask as scratch
    rawMaskCtx.clearRect(0, 0, W, H);
    rawMaskCtx.filter = `blur(${FEATHER_BLUR_PX}px)`;
    rawMaskCtx.drawImage(workMaskCanvas, 0, 0);
    rawMaskCtx.filter = 'none';
    workMaskCtx.clearRect(0, 0, W, H);
    workMaskCtx.drawImage(rawMaskCanvas, 0, 0);
  }
}

function onResults(results) {
  if (!ctx || !running) return;
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
 * Soft-matte fallback when MediaPipe is unavailable.
 * Stable opaque oval over the torso/head — no per-frame jitter, solid interior.
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

    // Stable radial matte: fully opaque through most of the person, soft edge only
    const g = personCtx.createRadialGradient(
      W * 0.5, H * 0.42, H * 0.12,
      W * 0.5, H * 0.48, H * 0.46
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
