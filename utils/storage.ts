import { FleetRecord, TruckRecord, UploadedFile, User, ThemeSettings } from "../types";

const DB_NAME = 'LogisticaAI_DB';
const DB_VERSION = 2; // Incremented version for new stores
const STORES = {
  RECORDS: 'records',
  FLEET: 'fleet',
  FILES: 'files',
  USERS: 'users',
  SETTINGS: 'settings'
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('Error opening database');

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        db.createObjectStore(STORES.RECORDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.FLEET)) {
        db.createObjectStore(STORES.FLEET, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        db.createObjectStore(STORES.FILES, { keyPath: 'id' });
      }
      // New Stores
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'email' }); // Email is unique key
        // Add default admin
        userStore.add({
            id: 'admin-1',
            email: 'admin@logistica.ai',
            password: 'admin', // Simple storage for demo
            name: 'Administrador',
            role: 'admin',
            createdAt: Date.now()
        });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

// --- DATA METHODS ---

export const saveRecords = async (records: TruckRecord[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORES.RECORDS, 'readwrite');
  const store = tx.objectStore(STORES.RECORDS);
  records.forEach(record => store.put(record));
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getRecords = async (): Promise<TruckRecord[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.RECORDS, 'readonly');
    const store = tx.objectStore(STORES.RECORDS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const clearRecords = async (): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.RECORDS, 'readwrite');
    tx.objectStore(STORES.RECORDS).clear();
    return new Promise((resolve) => tx.oncomplete = () => resolve());
};

export const saveFleet = async (fleet: FleetRecord[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORES.FLEET, 'readwrite');
  const store = tx.objectStore(STORES.FLEET);
  store.clear();
  fleet.forEach(item => store.add(item));
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getFleet = async (): Promise<FleetRecord[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.FLEET, 'readonly');
    const store = tx.objectStore(STORES.FLEET);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const saveFiles = async (files: UploadedFile[]): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.FILES, 'readwrite');
    const store = tx.objectStore(STORES.FILES);
    files.forEach(file => {
        const fileToSave = {
            ...file,
            id: file.id || `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            originalFile: undefined
        };
        store.put(fileToSave);
    });
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getFiles = async (): Promise<UploadedFile[]> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORES.FILES, 'readonly');
        const store = tx.objectStore(STORES.FILES);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.sort((a: any, b: any) => b.timestamp - a.timestamp));
    });
};

export const deleteFile = async (id: string): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.FILES, 'readwrite');
    tx.objectStore(STORES.FILES).delete(id);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
}

// --- USER & SETTINGS METHODS ---

export const getUsers = async (): Promise<User[]> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORES.USERS, 'readonly');
        const store = tx.objectStore(STORES.USERS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
};

export const saveUser = async (user: User): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.USERS, 'readwrite');
    const store = tx.objectStore(STORES.USERS);
    store.put(user);
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const saveTheme = async (theme: ThemeSettings): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.SETTINGS);
    store.put({ key: 'theme', value: theme });
    return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getTheme = async (): Promise<ThemeSettings | null> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORES.SETTINGS, 'readonly');
        const store = tx.objectStore(STORES.SETTINGS);
        const request = store.get('theme');
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
    });
};