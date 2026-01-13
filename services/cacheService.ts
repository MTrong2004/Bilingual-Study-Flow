import { ProcessedData } from "../types";

const DB_NAME = 'BilingualFlowDB';
const STORE_NAME = 'translations';
const DB_VERSION = 1;
const CACHE_PREFIX = "v2_"; 

// --- IndexedDB Helper Functions ---

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(new Error("Failed to open IndexedDB"));
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create store. Key is the fingerprint string.
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Generate a unique hash based on file content (First 2KB) + Exact Size
export const generateFingerprint = async (file: File): Promise<string> => {
  // 1. Primary Key: File Size
  const size = file.size;
  
  // 2. Secondary Key: First 2KB of binary data (Header)
  const chunk = file.slice(0, 2048); 
  const buffer = await chunk.arrayBuffer();
  const headerBytes = new Uint8Array(buffer);
  
  let headerHex = "";
  for (let i = 0; i < headerBytes.length; i++) {
    headerHex += headerBytes[i].toString(16).padStart(2, '0');
  }

  // Final Key: v2_10485760_a1b2c3d4...
  return `${CACHE_PREFIX}${size}_${headerHex.substring(0, 64)}`;
};

export const saveToCache = async (file: File, data: ProcessedData): Promise<void> => {
  try {
    const key = await generateFingerprint(file);
    const db = await openDB();
    
    const cacheEntry = {
      timestamp: Date.now(),
      fileName: file.name,
      data: data
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(cacheEntry, key);

      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved translation for ${file.name}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error("[IndexedDB] Save failed:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Failed to save to cache:", error);
  }
};

export const getFromCache = async (file: File): Promise<ProcessedData | null> => {
  try {
    const key = await generateFingerprint(file);
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          console.log(`[IndexedDB] Cache Hit for: ${file.name}`);
          resolve(result.data as ProcessedData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("[IndexedDB] Read failed:", request.error);
        resolve(null); // Fail gracefully
      };
    });
  } catch (error) {
    console.error("Error reading from cache:", error);
    return null;
  }
};
