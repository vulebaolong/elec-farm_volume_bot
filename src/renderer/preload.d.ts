import { ElectronHandler } from '../main/preload';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    sessions: {
      list: () => Promise<Array<{ name: string; path: string; existsOnDisk: boolean }>>;
      clear: (name: string) => Promise<{ ok: boolean }>;
      openPath: (name: string) => Promise<{ ok: boolean }>;
    };
  }
}

export {};
