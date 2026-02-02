import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Database Schema
interface WSstatusDatabase extends DBSchema {
  "temp-media": {
    key: string;
    value: {
      id: string;
      blob: Blob;
      timestamp: number;
    };
  };
  "ffmpeg-cache": {
    key: string;
    value: {
      key: string;
      data: ArrayBuffer;
      timestamp: number;
    };
  };
}

const DB_NAME = "wamo-v1";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<WSstatusDatabase> | null = null;

// Initialize database
export async function initDB(): Promise<IDBPDatabase<WSstatusDatabase>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WSstatusDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Temporary media storage
      if (!db.objectStoreNames.contains("temp-media")) {
        db.createObjectStore("temp-media", { keyPath: "id" });
      }

      // FFmpeg binary cache
      if (!db.objectStoreNames.contains("ffmpeg-cache")) {
        db.createObjectStore("ffmpeg-cache", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

// Store temporary blob
export async function storeTempBlob(id: string, blob: Blob): Promise<void> {
  const db = await initDB();
  await db.put("temp-media", {
    id,
    blob,
    timestamp: Date.now(),
  });
}

// Retrieve temporary blob
export async function getTempBlob(id: string): Promise<Blob | null> {
  const db = await initDB();
  const record = await db.get("temp-media", id);
  return record?.blob || null;
}

// Delete temporary blob
export async function deleteTempBlob(id: string): Promise<void> {
  const db = await initDB();
  await db.delete("temp-media", id);
}

// Clear old temporary files (older than 24 hours)
export async function clearOldTempFiles(): Promise<void> {
  const db = await initDB();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

  const tx = db.transaction("temp-media", "readwrite");
  const store = tx.objectStore("temp-media");
  const cursor = await store.openCursor();

  const deletePromises: Promise<void>[] = [];

  if (cursor) {
    for await (const entry of store) {
      if (entry.value.timestamp < cutoff) {
        deletePromises.push(store.delete(entry.value.id));
      }
    }
  }

  await Promise.all(deletePromises);
  await tx.done;
}

// Cache ffmpeg data
export async function cacheFFmpegData(
  key: string,
  data: ArrayBuffer
): Promise<void> {
  const db = await initDB();
  await db.put("ffmpeg-cache", {
    key,
    data,
    timestamp: Date.now(),
  });
}

// Get cached ffmpeg data
export async function getFFmpegCache(key: string): Promise<ArrayBuffer | null> {
  const db = await initDB();
  const record = await db.get("ffmpeg-cache", key);
  return record?.data || null;
}
