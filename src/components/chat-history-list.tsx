"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ChatSessionSummary } from "@/lib/chat-session";
import { subscribeChatSessionsChanged } from "@/lib/chat-session-bus";
import { ForkIcon, MoreHorizontalIcon, PinIcon, TrashIcon } from "@/components/studio-icons";

type MenuState = { session: ChatSessionSummary; x: number; y: number };

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function formatRelativeTime(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    if (abs >= secondsInUnit) {
      return relativeFormatter.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return "Just now";
}

function sortSessions(a: ChatSessionSummary, b: ChatSessionSummary): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

/** Sidebar "Recent" list of Studio chat sessions, with right-click (and ⋯ button)
 * actions to pin, fork, or delete a chat without leaving the current one. */
export function ChatHistoryList({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = searchParams.get("session");

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [, startTransition] = useTransition();

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/assistant/sessions");
      if (!response.ok) return;
      const data = (await response.json()) as { sessions: ChatSessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // best-effort — the Recent list degrades to empty rather than erroring the sidebar
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void loadSessions();
    });
    return subscribeChatSessionsChanged(loadSessions);
  }, [loadSessions, startTransition]);

  useEffect(() => {
    if (!menu) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    function handleScroll() {
      setMenu(null);
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menu]);

  function handleRowContextMenu(event: ReactMouseEvent, session: ChatSessionSummary) {
    event.preventDefault();
    setMenu({ session, x: event.clientX, y: event.clientY });
  }

  function handleMoreClick(event: ReactMouseEvent<HTMLButtonElement>, session: ChatSessionSummary) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ session, x: rect.right, y: rect.bottom + 4 });
  }

  async function handleTogglePin(session: ChatSessionSummary) {
    setMenu(null);
    const nextPinned = !session.pinned;
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, pinned: nextPinned } : s)).sort(sortSessions),
    );
    setBusyId(session.id);
    try {
      await fetch(`/api/assistant/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleFork(session: ChatSessionSummary) {
    setMenu(null);
    setBusyId(session.id);
    try {
      const response = await fetch(`/api/assistant/sessions/${session.id}/fork`, { method: "POST" });
      if (!response.ok) return;
      const data = (await response.json()) as { session: ChatSessionSummary };
      await loadSessions();
      onNavigate?.();
      router.push(`/assistant?session=${data.session.id}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(session: ChatSessionSummary) {
    setMenu(null);
    if (!window.confirm(`Delete "${session.title}"? This can't be undone.`)) return;
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    setBusyId(session.id);
    try {
      await fetch(`/api/assistant/sessions/${session.id}`, { method: "DELETE" });
    } finally {
      setBusyId(null);
    }
    if (activeSessionId === session.id) {
      onNavigate?.();
      router.push("/assistant");
    }
  }

  return (
    <div className="lf-recent">
      <div className="lf-recent-heading">
        <span>Recent</span>
      </div>

      {!loaded ? <p className="lf-recent-empty">Loading…</p> : null}
      {loaded && sessions.length === 0 ? (
        <p className="lf-recent-empty">No chats yet — start one above.</p>
      ) : null}

      <div className="lf-recent-list">
        {sessions.map((session) => {
          const active = session.id === activeSessionId;
          return (
            <div
              key={session.id}
              className={`lf-recent-row${active ? " lf-recent-row--active" : ""}${
                busyId === session.id ? " lf-recent-row--busy" : ""
              }`}
              onContextMenu={(event) => handleRowContextMenu(event, session)}
            >
              <Link
                href={`/assistant?session=${session.id}`}
                onClick={onNavigate}
                className="lf-recent-row-link"
              >
                {session.pinned ? (
                  <span className="lf-recent-row-pin" aria-label="Pinned" title="Pinned">
                    <PinIcon width={11} height={11} />
                  </span>
                ) : null}
                <span className="lf-recent-row-title">{session.title}</span>
                <span className="lf-recent-row-time">{formatRelativeTime(session.updatedAt)}</span>
              </Link>
              <button
                type="button"
                className="lf-recent-row-more"
                aria-label="Chat actions"
                aria-haspopup="menu"
                onClick={(event) => handleMoreClick(event, session)}
              >
                <MoreHorizontalIcon width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          className="lf-context-menu"
          style={{ position: "fixed", top: menu.y, left: Math.min(menu.x, window.innerWidth - 200) }}
        >
          <button
            type="button"
            role="menuitem"
            className="lf-context-menu-item"
            onClick={() => handleTogglePin(menu.session)}
          >
            <PinIcon width={14} height={14} />
            {menu.session.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="lf-context-menu-item"
            onClick={() => handleFork(menu.session)}
          >
            <ForkIcon width={14} height={14} />
            Fork and start new
          </button>
          <button
            type="button"
            role="menuitem"
            className="lf-context-menu-item lf-context-menu-item--danger"
            onClick={() => handleDelete(menu.session)}
          >
            <TrashIcon width={14} height={14} />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
