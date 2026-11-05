/**
 * Person segmentation + canvas compositing.
 * Uses MediaPipe Selfie Segmentation when available; graceful fallback otherwise.
 */
import { drawBackgroundCover, getCurrentBackgroundImage } from './backgrounds.js';

const W = 640;
const H = 480;

let selfieSegmentation = null;
let ready = false;
let useFallback = false;
let videoEl = null;
let canvas = null;
let ctx = null;
let maskCanvas = null;
let maskCtx = null;
let running = false;
let rafId = null;
let outputStream = null;
let lastProcess = 0;
const PROCESS_EVERY_MS = 33; // ~30fps

export function isSegmentationReady() {
  return ready;
}

export async function initSegmentation() {
  // Dynamic import of MediaPipe from CDN via script injection (UMD global)
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js');
    const SS = window.SelfieSegmentation;
    if (!SS) throw new Error('SelfieSegmentation global missing');

    selfieSegmentation = new SS({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    selfieSegmentation.setOptions({
      modelSelection: 1, // landscape
      selfieMode: true,
    });
    await selfieSegmentation.initialize?.();
    ready = true;
    useFallback = false;
    console.log('[CrapChat] MediaPipe Selfie Segmentation ready');
    return true;
  } catch (err) {
    console.warn('[CrapChat] Segmentation unavailable, using rectangular soft-matte fallback', err);
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

/**
 * Bind a camera video element and an output canvas; returns MediaStream of the canvas.
 */
export function startCompositor(video, outCanvas) {
  videoEl = video;
  canvas = outCanvas;
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  maskCanvas = document.createElement('canvas');
  maskCanvas.width = W;
  maskCanvas.height = H;
  maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  running = true;

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

export function stopCompositor() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  outputStream?.getTracks().forEach((t) => t.stop());
  outputStream = null;
}

function loopMediapipe() {
  if (!running) return;
  const now = performance.now();
  const tick = async () => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (!videoEl || videoEl.readyState < 2) return;
    const t = performance.now();
    if (t - lastProcess < PROCESS_EVERY_MS) return;
    lastProcess = t;
    try {
      await selfieSegmentation.send({ image: videoEl });
    } catch (e) {
      // occasional send errors — ignore
    }
  };
  rafId = requestAnimationFrame(tick);
}

function onResults(results) {
  if (!ctx || !running) return;
  const bg = getCurrentBackgroundImage();
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackgroundCover(ctx, bg, W, H);

  if (results.segmentationMask) {
    // Soft composite: draw person where mask is opaque
    maskCtx.clearRect(0, 0, W, H);
    maskCtx.drawImage(results.segmentationMask, 0, 0, W, H);
    // Use person image with mask as alpha
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(results.image, 0, 0, W, H);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(maskCanvas, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  } else {
    ctx.drawImage(videoEl, 0, 0, W, H);
  }
  ctx.restore();
}

function loopFallback() {
  const tick = () => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (!videoEl || videoEl.readyState < 2 || !ctx) return;
    const bg = getCurrentBackgroundImage();
    ctx.clearRect(0, 0, W, H);
    drawBackgroundCover(ctx, bg, W, H);

    // Soft oval "person" matte fallback so backgrounds still show
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const tctx = tmp.getContext('2d');
    tctx.drawImage(videoEl, 0, 0, W, H);
    tctx.globalCompositeOperation = 'destination-in';
    const g = tctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.15, W * 0.5, H * 0.5, H * 0.48);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    tctx.fillStyle = g;
    tctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp, 0, 0);
  };
  rafId = requestAnimationFrame(tick);
}

/** Mirror preview onto a second canvas (same frames) — we just share one compositor canvas per view */
export function resizeCompositor(w, h) {
  if (!canvas) return;
  // Keep internal processing size fixed for perf; CSS scales display
}
