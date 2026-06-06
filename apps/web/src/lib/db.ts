import type { ForageRepository, ImportEvent } from "@forage/shared";

const dbName = "forage";
const dbVersion = 1;

export async function saveRepositories(repositories: ForageRepository[]) {
  const db = await openDb();
  const tx = db.transaction("repositories", "readwrite");
  const store = tx.objectStore("repositories");
  for (const repository of repositories) {
    store.put(repository);
  }
  await txDone(tx);
  db.close();
}

export async function getAllRepositories() {
  const db = await openDb();
  const tx = db.transaction("repositories", "readonly");
  const request = tx.objectStore("repositories").getAll();
  const repositories = await requestDone<ForageRepository[]>(request);
  db.close();
  return repositories;
}

export async function saveImportEvent(event: ImportEvent) {
  const db = await openDb();
  const tx = db.transaction("importEvents", "readwrite");
  tx.objectStore("importEvents").put(event);
  await txDone(tx);
  db.close();
}

export async function getImportEvents() {
  const db = await openDb();
  const tx = db.transaction("importEvents", "readonly");
  const request = tx.objectStore("importEvents").getAll();
  const events = await requestDone<ImportEvent[]>(request);
  db.close();
  return events.sort((left, right) => right.started_at.localeCompare(left.started_at));
}

export async function resetLocalData() {
  const db = await openDb();
  const tx = db.transaction(["repositories", "importEvents"], "readwrite");
  tx.objectStore("repositories").clear();
  tx.objectStore("importEvents").clear();
  await txDone(tx);
  db.close();
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
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

function requestDone<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
