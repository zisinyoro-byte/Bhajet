// Offline storage using IndexedDB
const DB_NAME = 'techmari-budget-offline';
const DB_VERSION = 1;

interface OfflineTransaction {
  id: string;
  type: 'income' | 'expenditure';
  expenditureType?: 'regular' | 'capital';
  amount: number;
  category: string;
  date: string;
  note: string | null;
  receipt: string | null;
  merchantName?: string | null;
  receiptDate?: string | null;
  receiptTotal?: number | null;
  isFromReceipt?: boolean;
  synced: boolean;
  createdAt: string;
}

interface OfflineGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  action: 'create' | 'update' | 'delete';
  synced: boolean;
}

interface OfflineLoan {
  id: string;
  borrowerName: string;
  amount: number;
  remainingAmount: number;
  dateLoaned: string;
  dueDate: string | null;
  status: string;
  note: string | null;
  action: 'create' | 'repayment' | 'delete';
  synced: boolean;
}

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Transactions store
      if (!database.objectStoreNames.contains('transactions')) {
        const txStore = database.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('synced', 'synced', { unique: false });
        txStore.createIndex('date', 'date', { unique: false });
      }

      // Goals store
      if (!database.objectStoreNames.contains('goals')) {
        const goalStore = database.createObjectStore('goals', { keyPath: 'id' });
        goalStore.createIndex('synced', 'synced', { unique: false });
      }

      // Loans store
      if (!database.objectStoreNames.contains('loans')) {
        const loanStore = database.createObjectStore('loans', { keyPath: 'id' });
        loanStore.createIndex('synced', 'synced', { unique: false });
      }

      // Sync queue for pending operations
      if (!database.objectStoreNames.contains('syncQueue')) {
        const syncStore = database.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      // Cached data for offline viewing
      if (!database.objectStoreNames.contains('cache')) {
        database.createObjectStore('cache', { keyPath: 'key' });
      }
    };
  });
}

// Transaction operations
export async function saveOfflineTransaction(transaction: OfflineTransaction): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.put(transaction);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineTransactions(): Promise<OfflineTransaction[]> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineTransaction(id: string): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Sync queue operations
export async function addToSyncQueue(operation: {
  type: 'transaction' | 'goal' | 'loan' | 'budget' | 'category';
  action: 'create' | 'update' | 'delete';
  data: unknown;
}): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const request = store.add({ ...operation, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncQueue(): Promise<Array<{
  id: number;
  type: string;
  action: string;
  data: unknown;
  timestamp: number;
}>> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncQueueItem(id: number): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Cache operations
export async function cacheData(key: string, data: unknown): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const request = store.put({ key, data, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData(key: string): Promise<{
  data: unknown;
  timestamp: number;
} | null> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function clearCache(): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Check online status
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getSyncQueue();
  return queue.length;
}
