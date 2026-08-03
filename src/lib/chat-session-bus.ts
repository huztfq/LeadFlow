"use client";

/**
 * Tiny in-memory pub/sub so the Studio chat page can tell the sidebar's
 * "Recent" list to refetch after it creates, saves, pins, forks, or deletes
 * a chat session — without threading state through the app layout.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyChatSessionsChanged(): void {
  for (const listener of listeners) listener();
}

export function subscribeChatSessionsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
