/**
 * Background scene catalog + image loading for compositing.
 */
import {
  listCustomBackgrounds,
  saveCustomBackground,
  clearCustomBackgrounds,
  getSelectedBgId,
  setSelectedBgId,
} from './storage.js';

let manifestScenes = [];
/** @type {Map<string, HTMLImageElement|HTMLCanvasElement>} */
const imageCache = new Map();
let currentId = 'business-office';
let currentImage = null;

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'office', label: 'Office' },
  { id: 'home', label: 'Home' },
  { id: 'nature', label: 'Nature' },
  { id: 'urban', label: 'Urban' },
  { id: 'fun', label: 'Fun' },
  { id: 'custom', label: 'Custom' },
];

export async function loadManifest() {
  const res = await fetch('/assets/backgrounds/manifest.json');
  const data = await res.json();
  manifestScenes = data.scenes || [];
  return manifestScenes;
}

export function getBuiltinScenes() {
  return manifestScenes;
}

export async function getAllScenes() {
  const customs = await listCustomBackgrounds();
  const customScenes = customs.map((c) => ({
    id: c.id,
    name: c.name,
    category: 'custom',
    file: null,
    blob: c.blob,
  }));
  return [...manifestScenes, ...customScenes];
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function loadSceneImage(scene) {
  if (imageCache.has(scene.id)) return imageCache.get(scene.id);
  let img;
  if (scene.blob) {
    const url = URL.createObjectURL(scene.blob);
    img = await loadImageFromUrl(url);
  } else {
    img = await loadImageFromUrl(`/assets/backgrounds/${scene.file}`);
  }
  imageCache.set(scene.id, img);
  return img;
}

export async function selectBackground(id) {
  const scenes = await getAllScenes();
  const scene = scenes.find((s) => s.id === id) || scenes[0];
  if (!scene) return null;
  currentId = scene.id;
  setSelectedBgId(currentId);
  currentImage = await loadSceneImage(scene);
  return { scene, image: currentImage };
}

export function getCurrentBackgroundImage() {
  return currentImage;
}

export function getCurrentBackgroundId() {
  return currentId;
}

export async function initBackground() {
  await loadManifest();
  const id = getSelectedBgId();
  return selectBackground(id);
}

export async function uploadCustomBackground(file) {
  const id = `custom-${Date.now()}`;
  const name = (file.name || 'Custom').replace(/\.[^.]+$/, '').slice(0, 24);
  await saveCustomBackground(id, name, file);
  imageCache.delete(id);
  return selectBackground(id);
}

export async function removeAllCustoms() {
  await clearCustomBackgrounds();
  for (const key of [...imageCache.keys()]) {
    if (key.startsWith('custom-')) imageCache.delete(key);
  }
  if (currentId.startsWith('custom-')) {
    return selectBackground('business-office');
  }
  return { scene: null, image: currentImage };
}

/** Draw cover-fit background into canvas */
export function drawBackgroundCover(ctx, img, w, h) {
  if (!img) {
    ctx.fillStyle = '#1c0f30';
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const iw = img.width || img.videoWidth;
  const ih = img.height || img.videoHeight;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}
