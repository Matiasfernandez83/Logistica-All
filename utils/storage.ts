
import { FleetRecord, TruckRecord, ExpenseRecord, UploadedFile, User, ThemeSettings } from "../types";

const DB_NAME = 'LogisticaAI_DB';
const DB_VERSION = 4; // Incremented version for new 'expenses' store
const STORES = {
  RECORDS: 'records',
  EXPENSES: 'expenses', // NEW STORE
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
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
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
        // Add default admin with new domain
        userStore.add({
            id: 'admin-1',
            email: 'admin@logisticaintegral.com.ar',
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

// --- TRUCK RECORD METHODS ---

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

export const deleteRecords = async (ids: string[]): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.RECORDS, 'readwrite');
    const store = tx.objectStore(STORES.RECORDS);
    ids.forEach(id => store.delete(id));
    return new Promise((resolve) => tx.oncomplete = () => resolve());
};

// --- EXPENSE RECORD METHODS (NEW) ---

export const saveExpenses = async (records: ExpenseRecord[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORES.EXPENSES, 'readwrite');
  const store = tx.objectStore(STORES.EXPENSES);
  records.forEach(record => store.put(record));
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getExpenses = async (): Promise<ExpenseRecord[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.EXPENSES, 'readonly');
    const store = tx.objectStore(STORES.EXPENSES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
};

export const clearExpenses = async (): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.EXPENSES, 'readwrite');
    tx.objectStore(STORES.EXPENSES).clear();
    return new Promise((resolve) => tx.oncomplete = () => resolve());
};

export const deleteExpenses = async (ids: string[]): Promise<void> => {
    const db = await openDB();
    const tx = db.transaction(STORES.EXPENSES, 'readwrite');
    const store = tx.objectStore(STORES.EXPENSES);
    ids.forEach(id => store.delete(id));
    return new Promise((resolve) => tx.oncomplete = () => resolve());
};


// --- SHARED / OTHER METHODS ---

// Updated: Delete records associated with a specific file (Handles both TruckRecords and Expenses)
export const deleteRecordsByFileId = async (fileId: string): Promise<void> => {
    const db = await openDB();
    
    // 1. Delete Truck Records
    const txRecords = db.transaction(STORES.RECORDS, 'readwrite');
    const storeRecords = txRecords.objectStore(STORES.RECORDS);
    const allRecords = await getRecords();
    allRecords.filter(r => r.sourceFileId === fileId).forEach(r => storeRecords.delete(r.id));

    // 2. Delete Expense Records (Wait for previous tx or do parallel? Sequential for safety here)
    // We need to commit first or open new transaction. IndexedDB transactions are short-lived.
    
    return new Promise((resolve) => {
         txRecords.oncomplete = async () => {
             const txExpenses = db.transaction(STORES.EXPENSES, 'readwrite');
             const storeExpenses = txExpenses.objectStore(STORES.EXPENSES);
             const allExpenses = await getExpenses();
             allExpenses.filter(e => e.sourceFileId === fileId).forEach(e => storeExpenses.delete(e.id));
             txExpenses.oncomplete = () => resolve();
         };
    });
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
        // If ID is already set, use it, otherwise generate one
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

export const getFileById = async (id: string): Promise<UploadedFile | undefined> => {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORES.FILES, 'readonly');
        const store = tx.objectStore(STORES.FILES);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
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
