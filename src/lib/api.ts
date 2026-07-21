// Client-side Supabase Database API Helper & Sync Manager

export interface SupabaseStatus {
  connected: boolean;
  url: string | null;
  reason: "connected" | "missing_keys";
}

// Convert camelCase string/object to snake_case
export function camelToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key
      .replace(/([A-Z])/g, "_$1")
      .replace(/([0-9]+)/g, "_$1")
      .replace(/_+/g, "_")
      .toLowerCase();
    result[snakeKey] = camelToSnake(obj[key]);
  }
  return result;
}

// Convert snake_case string/object to camelCase
export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

// Helper to write to localStorage safely, preventing crash when browser quota is full
export function safeLocalStorageSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    if (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    ) {
      console.warn("localStorage quota exceeded! Data was not saved locally, but continues in memory/remotely.", error);
      return false;
    }
    console.error("Failed to write to localStorage:", error);
    return false;
  }
}

// Helper to parse JSON safely and report HTML fallbacks
async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  
  if (!contentType.includes("application/json") && (text.trim().startsWith("<") || text.trim().startsWith("<!doctype"))) {
    // Gracefully handle HTML/Server Startup/Proxy templates without throwing loud console.errors
    console.warn("Menerima respon HTML dari server. Kemungkinan server sedang melakukan startup atau restart.");
    throw new Error("Respon dari server tidak valid (bukan format JSON). Silakan segarkan halaman jika server baru saja dinyalakan.");
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn("Gagal memproses JSON. Response didapat:", text.slice(0, 100));
    throw new Error("Respon dari server tidak valid (bukan format JSON). Silakan segarkan halaman jika server baru saja dinyalakan.");
  }
}

// Check if Supabase connection is configured and available
export async function getSupabaseStatus(): Promise<SupabaseStatus> {
  try {
    const res = await fetch("/api/supabase-status");
    if (!res.ok) throw new Error("Status API error");
    return await safeJsonParse(res);
  } catch (error) {
    return { connected: false, url: null, reason: "missing_keys" };
  }
}

// Fetch list of items from table with localStorage fallback
export async function fetchTableData<T>(table: string, localKey: string, defaultValue: T[] = []): Promise<T[]> {
  try {
    const status = await getSupabaseStatus();
    if (status.connected) {
      const res = await fetch(`/api/db/${table}`);
      if (res.ok) {
        const result = await safeJsonParse(res);
        if (result.success && Array.isArray(result.data)) {
          // Translate snake_case keys from database to camelCase for the React application
          const camelCasedData = snakeToCamel(result.data) as T[];
          // Deduplicate by ID to prevent duplicate keys in React loops
          const uniqueMap = new Map<any, T>();
          camelCasedData.forEach((item: any) => {
            if (item && item.id) {
              uniqueMap.set(item.id, item);
            } else if (item) {
              uniqueMap.set(Math.random().toString(), item);
            }
          });
          const uniqueData = Array.from(uniqueMap.values());
          // Sync/save to local storage as backup cache
          safeLocalStorageSetItem(localKey, JSON.stringify(uniqueData));
          return uniqueData;
        }
      }
    }
  } catch (err) {
    console.warn(`Supabase offline or failed for table ${table}. Using localStorage fallback.`, err);
  }

  // Local storage fallback
  const local = localStorage.getItem(localKey);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const uniqueMap = new Map<any, T>();
      arr.forEach((item: any) => {
        if (item && item.id) {
          uniqueMap.set(item.id, item);
        } else if (item) {
          uniqueMap.set(Math.random().toString(), item);
        }
      });
      return Array.from(uniqueMap.values());
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
}

// Insert single row with remote & local sync
export async function insertTableRow<T extends { id?: any }>(table: string, localKey: string, row: T): Promise<T> {
  let remoteRow: T | null = null;
  
  try {
    const status = await getSupabaseStatus();
    if (status.connected) {
      // Translate camelCase fields to snake_case for PostgreSQL database
      const snakeCasedRow = camelToSnake(row);
      const res = await fetch(`/api/db/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snakeCasedRow),
      });
      
      if (res.ok) {
        const result = await safeJsonParse(res);
        if (result.success && result.data) {
          remoteRow = snakeToCamel(result.data) as T;
        } else if (result.success === false) {
          throw new Error(result.error || "Gagal menyimpan data ke Supabase.");
        }
      } else {
        const errData = await safeJsonParse(res).catch(() => ({}));
        throw new Error(errData.error || `Server HTTP Error: ${res.status}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to insert into Supabase table ${table}:`, err);
    throw err; // Re-throw so UI can handle and display the error
  }

  // Use either returned server row or the local row
  const savedRow = remoteRow || row;

  // Sync to local list (always in camelCase)
  const local = localStorage.getItem(localKey);
  let currentList: any[] = [];
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        currentList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        currentList = [parsed];
      }
    } catch (e) {
      currentList = [];
    }
  }
  const filteredList = currentList.filter((item: any) => item && item.id !== savedRow.id);
  safeLocalStorageSetItem(localKey, JSON.stringify([savedRow, ...filteredList]));

  return savedRow;
}

// Insert multiple rows in bulk/batch with remote & local sync
export async function insertTableRows<T extends { id?: any }>(table: string, localKey: string, rows: T[]): Promise<T[]> {
  if (!rows || rows.length === 0) return [];
  let remoteRows: T[] | null = null;
  
  try {
    const status = await getSupabaseStatus();
    if (status.connected) {
      // Translate camelCase fields to snake_case for PostgreSQL database
      const snakeCasedRows = camelToSnake(rows);
      const res = await fetch(`/api/db/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snakeCasedRows),
      });
      
      if (res.ok) {
        const result = await safeJsonParse(res);
        if (result.success && result.data) {
          const fetched = result.data;
          remoteRows = (Array.isArray(fetched) ? snakeToCamel(fetched) : [snakeToCamel(fetched)]) as T[];
        } else if (result.success === false) {
          throw new Error(result.error || "Gagal menyimpan data ke Supabase.");
        }
      } else {
        const errData = await safeJsonParse(res).catch(() => ({}));
        throw new Error(errData.error || `Server HTTP Error: ${res.status}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to bulk insert into Supabase table ${table}:`, err);
    throw err; // Re-throw so UI can handle and display the error
  }

  // Use either returned server rows or the local rows
  const savedRows = remoteRows && remoteRows.length > 0 ? remoteRows : rows;

  // Sync to local list (always in camelCase)
  const local = localStorage.getItem(localKey);
  let currentList: any[] = [];
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        currentList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        currentList = [parsed];
      }
    } catch (e) {
      currentList = [];
    }
  }
  
  // Merge lists by replacing or adding
  const savedIds = new Set(savedRows.map(r => r.id).filter(Boolean));
  const filteredList = currentList.filter((item: any) => item && item.id && !savedIds.has(item.id));
  const mergedList = [...savedRows, ...filteredList];
  
  safeLocalStorageSetItem(localKey, JSON.stringify(mergedList));

  return savedRows;
}

// Update single row with remote & local sync
export async function updateTableRow<T extends { id?: any }>(
  table: string,
  localKey: string,
  id: string | number,
  updatedData: Partial<T>
): Promise<T> {
  let remoteRow: T | null = null;

  try {
    const status = await getSupabaseStatus();
    if (status.connected) {
      // Translate camelCase fields to snake_case for PostgreSQL database
      const snakeCasedData = camelToSnake(updatedData);
      const res = await fetch(`/api/db/${table}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snakeCasedData),
      });
      
      if (res.ok) {
        const result = await safeJsonParse(res);
        if (result.success && result.data) {
          remoteRow = snakeToCamel(result.data) as T;
        } else if (result.success === false) {
          throw new Error(result.error || "Gagal mengupdate data di Supabase.");
        }
      } else {
        const errData = await safeJsonParse(res).catch(() => ({}));
        throw new Error(errData.error || `Server HTTP Error: ${res.status}`);
      }
    }
  } catch (err: any) {
    console.error(`Failed to update Supabase table ${table}:`, err);
    throw err;
  }

  // Sync to local list (always in camelCase, robust to single objects or lists)
  const local = localStorage.getItem(localKey);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const updatedList = parsed.map((item: any) => {
          if (item && (item.id === id || String(item.id) === String(id))) {
            return { ...item, ...updatedData, ...(remoteRow || {}) };
          }
          return item;
        });
        safeLocalStorageSetItem(localKey, JSON.stringify(updatedList));
      } else if (parsed && typeof parsed === 'object') {
        const updatedObject = { ...parsed, ...updatedData, ...(remoteRow || {}) };
        safeLocalStorageSetItem(localKey, JSON.stringify(updatedObject));
      }
    } catch (e) {
      console.error("Error parsing local state for sync:", e);
    }
  } else {
    const isSingleRow = id === 'main';
    const finalData = (remoteRow || { id, ...updatedData }) as T;
    safeLocalStorageSetItem(localKey, JSON.stringify(isSingleRow ? finalData : [finalData]));
  }

  return (remoteRow || { id, ...updatedData }) as T;
}

// Delete single row with remote & local sync
export async function deleteTableRow(table: string, localKey: string, id: string | number): Promise<boolean> {
  let success = false;

  try {
    const status = await getSupabaseStatus();
    if (status.connected) {
      const res = await fetch(`/api/db/${table}/${id}`, {
        method: "DELETE",
      });
      
      if (res.ok) {
        const result = await safeJsonParse(res);
        success = !!result.success;
        if (!result.success) {
          throw new Error(result.error || "Gagal menghapus data dari Supabase.");
        }
      } else {
        const errData = await safeJsonParse(res).catch(() => ({}));
        throw new Error(errData.error || `Server HTTP Error: ${res.status}`);
      }
    } else {
      success = true; // Local-only delete
    }
  } catch (err: any) {
    console.error(`Failed to delete from Supabase table ${table}:`, err);
    throw err;
  }

  // Sync to local list
  const local = localStorage.getItem(localKey);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const updatedList = parsed.filter((item) => item && item.id !== id);
        safeLocalStorageSetItem(localKey, JSON.stringify(updatedList));
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.id === id) {
          localStorage.removeItem(localKey);
        }
      }
    } catch (e) {
      console.error("Error deleting local row:", e);
    }
  }

  return success;
}

// Upload file to Supabase Storage Bucket
export async function uploadFileToStorage(base64DataUrl: string, originalName: string, fieldKey: string): Promise<string> {
  const status = await getSupabaseStatus();
  if (!status.connected) {
    // Fallback if Supabase is offline (keeps local copy)
    console.warn("Supabase is not connected. Using raw base64 data url as fallback storage.");
    return base64DataUrl;
  }

  // Extract base64 content and content type
  const match = base64DataUrl.match(/^data:(.*);base64,(.*)$/);
  if (!match) {
    throw new Error("Format file tidak valid.");
  }
  const contentType = match[1];
  const base64Data = match[2];

  // Create a unique filename
  const extension = originalName.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const uniqueFileName = `${fieldKey}_${timestamp}_${randomStr}.${extension}`;

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: uniqueFileName,
      fileBase64: base64Data,
      contentType: contentType
    })
  });

  if (!res.ok) {
    const errData = await safeJsonParse(res).catch(() => ({}));
    throw new Error(errData.error || "Gagal mengunggah file ke server.");
  }

  const result = await safeJsonParse(res);
  if (result.success && result.publicUrl) {
    return result.publicUrl;
  } else {
    throw new Error(result.error || "Gagal mendapatkan URL file dari server.");
  }
}

