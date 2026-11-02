function db() { return new Promise((resolve, reject) => { const r = indexedDB.open('applypilot', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', {keyPath:'id'}); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function vault(mode, value) {
  const d = await db();
  try { return await new Promise((resolve, reject) => { const tx = d.transaction('files', mode === 'list' || mode === 'get' ? 'readonly':'readwrite'); const s = tx.objectStore('files'); const r = mode === 'list' ? s.getAll() : mode === 'get' ? s.get(value) : mode === 'delete' ? s.delete(value) : s.put(value); tx.oncomplete = () => resolve(r.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { d.close(); }
}
