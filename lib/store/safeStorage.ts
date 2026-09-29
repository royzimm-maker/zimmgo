import type { StateStorage } from "zustand/middleware";

// localStorage for the trip store that never throws. zustand's persist
// writes synchronously inside every state update, so a full quota (roughly
// 5 MB), private-mode restrictions or blocked storage would otherwise make
// every store action throw. On failure the state simply isn't saved locally
// — it's still in memory and still syncs to the server.
let warned = false;

export const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn("[trip store] Couldn't save to this browser's storage — changes still sync to the server.", error);
      }
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};
