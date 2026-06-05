const dbName = "forage-pre-mvp";
const dbVersion = 1;

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("repositories")) {
        const store = db.createObjectStore("repositories", { keyPath: "github_id" });
        store.createIndex("full_name", "full_name", { unique: true });
        store.createIndex("primary_language", "primary_language", { unique: false });
        store.createIndex("starred_at", "starred_at", { unique: false });
      }

      if (!db.objectStoreNames.contains("importEvents")) {
        db.createObjectStore("importEvents", { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveRepositories(repositories) {
  const db = await openDb();
  const tx = db.transaction("repositories", "readwrite");
  const store = tx.objectStore("repositories");
  for (const repository of repositories) {
    store.put(repository);
  }
  await txDone(tx);
  db.close();
}

export async function saveImportEvent(event) {
  const db = await openDb();
  const tx = db.transaction("importEvents", "readwrite");
  tx.objectStore("importEvents").put(event);
  await txDone(tx);
  db.close();
}

export async function getAllRepositories() {
  const db = await openDb();
  const tx = db.transaction("repositories", "readonly");
  const request = tx.objectStore("repositories").getAll();
  const repositories = await new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return repositories;
}

export async function getImportEvents() {
  const db = await openDb();
  const tx = db.transaction("importEvents", "readonly");
  const request = tx.objectStore("importEvents").getAll();
  const events = await new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  db.close();
  return events.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export async function resetLocalData() {
  const db = await openDb();
  const tx = db.transaction(["repositories", "importEvents"], "readwrite");
  tx.objectStore("repositories").clear();
  tx.objectStore("importEvents").clear();
  await txDone(tx);
  db.close();
}
