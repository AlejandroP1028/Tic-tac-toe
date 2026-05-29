const STORAGE_KEY = "ttt-player-id";

/**
 * Returns a stable random ID for this browser, creating and persisting it in
 * localStorage on first use. Returns "" during SSR (no window).
 */
export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
