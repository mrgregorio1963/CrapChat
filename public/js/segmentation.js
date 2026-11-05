/**
 * Person segmentation + canvas compositing.
 * Canvas matches the camera's actual videoWidth/videoHeight so faces aren't stretched.
 */
import { drawBackgroundCover, getCurrentBackgroundImage } from './backgrounds.js';

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
const PROCESS_EVERY_MS = 33;
let canvasW = 640;
let canvasH = 480;
let resizeObserver = null;

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
  if (!maskCanvas) {
    maskCanvas = document.createElement('canvas');
    maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  }
  maskCanvas.width = vw;
  maskCanvas.height = vh;
  // Hint CSS aspect via style so object-fit has the right intrinsic ratio
  canvas.style.aspectRatio = `${vw} / ${vh}`;
  return true;
}

export function startCompositor(video, outCanvas) {
  videoEl = video;
  canvas = outCanvas;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  running = true;
  syncCanvasToVideo();

  const onMeta = () => syncCanvasToVideo();
  videoEl.addEventListener('loadedmetadata', onMeta);
  videoEl.addEventListener('resize', onMeta);
  // Some browsers fire resize on HTMLVideoElement when orientation changes
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

  // Recreate capture stream if canvas size changes mid-call would require
  // replaceTrack — callers rebuild outbound stream after start.
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

function onResults(results) {
  if (!ctx || !running) return;
  syncCanvasToVideo();
  const W = canvasW;
  const H = canvasH;
  const bg = getCurrentBackgroundImage();
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackgroundCover(ctx, bg, W, H);

  if (results.segmentationMask) {
    maskCtx.clearRect(0, 0, W, H);
    // Draw mask and person image at canvas size (same aspect as camera)
    maskCtx.drawImage(results.segmentationMask, 0, 0, W, H);
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const tctx = tmp.getContext('2d');
    // results.image matches the sent frame aspect
    tctx.drawImage(results.image, 0, 0, W, H);
    tctx.globalCompositeOperation = 'destination-in';
    tctx.drawImage(maskCanvas, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  } else if (videoEl) {
    // Contain-fit would letterbox; we fill canvas which already matches video aspect
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
    const bg = getCurrentBackgroundImage();
    ctx.clearRect(0, 0, W, H);
    drawBackgroundCover(ctx, bg, W, H);

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

export function resizeCompositor() {
  syncCanvasToVideo();
}
