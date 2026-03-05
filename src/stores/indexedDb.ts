// src/stores/indexedDb.ts

export const RAWY_DB_NAME = "rawy";
export const RAWY_DB_VERSION = 1;

export type StoreName = "projects" | "nodes" | "documents";

let cachedDb: IDBDatabase | null = null;

export async function openDb(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb;

  const request = indexedDB.open(RAWY_DB_NAME, RAWY_DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;

    // Projects
    if (!db.objectStoreNames.contains("projects")) {
      db.createObjectStore("projects", { keyPath: "id" });
    }

    // Documents
    if (!db.objectStoreNames.contains("documents")) {
      const store = db.createObjectStore("documents", { keyPath: "id" });
      store.createIndex("byProjectId", "projectId", { unique: false });
    }

    // Nodes
    if (!db.objectStoreNames.contains("nodes")) {
      const store = db.createObjectStore("nodes", { keyPath: "id" });
      store.createIndex("byProjectId", "projectId", { unique: false });
      store.createIndex("byProjectParent", ["projectId", "parentId"], {
        unique: false,
      });
    }
  };

  cachedDb = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB: failed to open database"));
    request.onblocked = () =>
      reject(
        new Error(
          "IndexedDB: open blocked (another tab may be using an old version)",
        ),
      );
  });

  cachedDb.onversionchange = () => {
    cachedDb?.close();
    cachedDb = null;
  };

  return cachedDb;
}

export async function tx(
  mode: IDBTransactionMode,
  stores: StoreName[],
): Promise<IDBTransaction> {
  const db = await openDb();
  return db.transaction(stores, mode);
}

export function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB: request failed"));
  });
}

export function done(txn: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    txn.oncomplete = () => resolve();
    txn.onerror = () =>
      reject(txn.error ?? new Error("IndexedDB: transaction error"));
    txn.onabort = () =>
      reject(txn.error ?? new Error("IndexedDB: transaction aborted"));
  });
}

/**
 * Helper function to avoid repeating `objectStore(...)` everywhere.
 *
 * Instead of writing:
 * ```
 * const txn = await tx("readonly", ["projects"]);
 * const projects = await req(txn.objectStore("projects").getAll());
 * await done(txn);
 * ```
 *
 * Write:
 * ```
 * const txn = await tx("readonly", ["projects"]);
 * const projects = await req(store(txn, "projects").getAll());
 * await done(txn);
 * ```
 */
export function store(txn: IDBTransaction, name: StoreName): IDBObjectStore {
  return txn.objectStore(name);
}
