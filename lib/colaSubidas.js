const DB_NAME = 'entregas-cola';
const DB_VERSION = 1;
const STORE = 'tomas_pendientes';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
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

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function agregarPendiente(item) {
  const db = await abrirDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(item);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPendientes() {
  const db = await abrirDB();
  const tx = db.transaction(STORE, 'readonly');
  return promisifyRequest(tx.objectStore(STORE).getAll());
}

async function obtenerPendiente(id) {
  const db = await abrirDB();
  const tx = db.transaction(STORE, 'readonly');
  return promisifyRequest(tx.objectStore(STORE).get(id));
}

export async function actualizarPendiente(id, cambios) {
  const item = await obtenerPendiente(id);
  if (!item) return;
  await agregarPendiente({ ...item, ...cambios });
}

export async function eliminarPendiente(id) {
  const db = await abrirDB();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
