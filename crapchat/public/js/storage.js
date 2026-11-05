/** IndexedDB + localStorage helpers for custom backgrounds */

const DB_NAME = 'crapchat';
const STORE = 'backgrounds';
const LS_SELECTED = 'crapchat.selectedBg';
const LS_NAME = 'crapchat.displayName';
const LS_SILENCER = 'crapchat.fartSilencer';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomBackground(id, name, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id, name, blob, created: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listCustomBackgrounds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearCustomBackgrounds() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCustomBackground(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getSelectedBgId() {
  return localStorage.getItem(LS_SELECTED) || 'business-office';
}
export function setSelectedBgId(id) {
  localStorage.setItem(LS_SELECTED, id);
}
export function getSavedName() {
  return localStorage.getItem(LS_NAME) || '';
}
export function setSavedName(n) {
  localStorage.setItem(LS_NAME, n);
}
export function getSilencerPref() {
  return localStorage.getItem(LS_SILENCER) === '1';
}
export function setSilencerPref(on) {
  localStorage.setItem(LS_SILENCER, on ? '1' : '0');
}
