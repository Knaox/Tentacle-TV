// Platform-agnostic storage interface.
// Web uses localStorage (sync). React Native uses AsyncStorage preloaded into an in-memory cache.
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UuidGenerator {
  randomUUID(): string;
}

/** Default web implementation backed by localStorage */
export class WebStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

/** Default web UUID generator using crypto.randomUUID() */
export class WebUuidGenerator implements UuidGenerator {
  randomUUID(): string {
    return crypto.randomUUID();
  }
}
