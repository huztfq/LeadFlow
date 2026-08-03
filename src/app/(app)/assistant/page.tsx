"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ChatMarkdown } from "@/components/chat-markdown";
import { PlanArtifact, type EnrollStatus } from "@/components/studio-canvas";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CollapseIcon,
  CopyIcon,
  DocumentIcon,
  ExpandIcon,
} from "@/components/studio-icons";
import type { ExecuteResult } from "@/lib/assistant-execute";
import { extractLatestPlan, extractPlanFromMessage, getMessageText } from "@/lib/assistant-ui";
import { clonePlan, planToText, type OutreachPlan } from "@/lib/assistant-plan";
import { deriveSessionTitle, type ChatSessionDetail } from "@/lib/chat-session";
import { notifyChatSessionsChanged } from "@/lib/chat-session-bus";

const SUGGESTIONS = [
  "Find dental clinic owners in Texas for implant consults",
  "Target medspa founders in NYC with a 3-email sequence",
  "Home services GMs in Florida — warm intro campaign",
];

// Chat pane width as a percentage of the split, so the default is a true 50/50 split with the
// artifact regardless of viewport size; users can still drag between roughly a third and two-thirds.
const CHAT_WIDTH_DEFAULT = 50;
const CHAT_WIDTH_MIN = 32;
const CHAT_WIDTH_MAX = 68;
const SAVE_DEBOUNCE_MS = 700;

function AssistantStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("session");

  const [input, setInput] = useState("");
  const [approving, setApproving] = useState(false);
  const [executeError, setExecuteError] = useState("");
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [startedPlanKey, setStartedPlanKey] = useState<string | null>(null);
  const [workingPlan, setWorkingPlan] = useState<OutreachPlan | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState("New chat");
  const lastPlanKeyRef = useRef<string | null>(null);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  // Tracks which session id our local state currently reflects, so the load
  // effect below can tell "the URL changed because a sidebar row was clicked"
  // apart from "the URL changed because we just created/renamed this session".
  const loadedSessionIdRef = useRef<string | null | undefined>(undefined);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the composer should reclaim focus once the in-flight send finishes —
  // set right before each send based on where focus was at that moment, so we
  // don't yank focus away if the user had deliberately clicked elsewhere.
  const shouldRefocusRef = useRef(false);
  const [, startTransition] = useTransition();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/assistant/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport,
  });

  const plan = extractLatestPlan(messages as UIMessage[]);
  const planKey = plan ? JSON.stringify(plan) : null;
  const workingPlanKey = workingPlan ? JSON.stringify(workingPlan) : null;
  const busy = status === "submitted" || status === "streaming";
  const hasArtifact = Boolean(workingPlan);
  const artifactVisible = hasArtifact && panelOpen;
  // Below lg there isn't room for chat + artifact side by side, so opening the
  // artifact behaves like fullscreen automatically (tap Close to get back to chat).
  const chatVisible = !(artifactVisible && (fullscreen || !isDesktop));

  // A fresh plan drafted by chat becomes the editable working copy on the canvas, and
  // opens the artifact panel — mirroring how a new Claude artifact auto-opens once drafted.
  // Field edits made on the canvas don't get clobbered unless chat drafts a new plan.
  useEffect(() => {
    if (planKey && planKey !== lastPlanKeyRef.current) {
      lastPlanKeyRef.current = planKey;
      setWorkingPlan(plan ? clonePlan(plan) : null);
      setPlanVersion((v) => v + 1);
      setExecuteResult(null);
      setExecuteError("");
      setStartedPlanKey(null);
      setPanelOpen(true);
    }
  }, [planKey, plan]);

  useEffect(() => {
    if (!resizing) return;
    function handleMove(event: PointerEvent) {
      const container = splitRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      const next = Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, percent));
      setChatWidth(next);
    }
    function handleUp() {
      setResizing(false);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(160, el.scrollHeight)}px`;
  }, [input]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The textarea is disabled while a message is in flight, which forces the
  // browser to blur it — so once it's re-enabled, hand focus back so the user
  // can keep typing without reaching for the mouse. Skipped if the user had
  // focused something outside the composer before the send kicked off.
  useEffect(() => {
    if (busy || !shouldRefocusRef.current) return;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [busy]);

  function resetLocalState() {
    stop();
    setSessionId(null);
    setSessionTitle("New chat");
    setSessionStarted(false);
    setMessages([]);
    setExecuteResult(null);
    setExecuteError("");
    setStartedPlanKey(null);
    setWorkingPlan(null);
    setPlanVersion(0);
    setPanelOpen(false);
    setFullscreen(false);
    lastPlanKeyRef.current = null;
  }

  function applyLoadedSession(session: ChatSessionDetail) {
    stop();
    const msgs = session.messages;
    const derivedPlan = extractLatestPlan(msgs);
    lastPlanKeyRef.current = derivedPlan ? JSON.stringify(derivedPlan) : null;
    const activePlan = session.plan ?? derivedPlan;
    setSessionId(session.id);
    setSessionTitle(session.title);
    setMessages(msgs);
    setWorkingPlan(activePlan ? clonePlan(activePlan) : null);
    setPlanVersion((v) => v + 1);
    setExecuteResult(null);
    setExecuteError("");
    setStartedPlanKey(null);
    setPanelOpen(Boolean(activePlan));
    setFullscreen(false);
    setSessionStarted(msgs.length > 0);
  }

  // Load (or clear) the chat whenever the `?session=` URL param points somewhere
  // we haven't already loaded locally — e.g. a sidebar row click, a browser back
  // navigation, or a fresh /assistant visit. Skipped right after we create or
  // rename a session ourselves, since loadedSessionIdRef is updated before the
  // URL is, so this effect doesn't stomp on state we already have in memory.
  useEffect(() => {
    if (urlSessionId === loadedSessionIdRef.current) return;
    loadedSessionIdRef.current = urlSessionId;

    if (!urlSessionId) {
      startTransition(() => resetLocalState());
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/assistant/sessions/${urlSessionId}`);
        if (!response.ok) throw new Error("Chat session not found");
        const data = (await response.json()) as { session: ChatSessionDetail };
        if (cancelled) return;
        applyLoadedSession(data.session);
      } catch {
        if (!cancelled) router.replace("/assistant");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only the URL param should drive (re)loads — helper functions close over
    // fresh state each render, and re-running on every render would refetch mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId]);

  async function persistSession() {
    const uiMessages = messages as UIMessage[];
    if (uiMessages.length === 0) return;
    const title = deriveSessionTitle(uiMessages) ?? sessionTitle;

    if (!sessionId) {
      try {
        const response = await fetch("/api/assistant/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, messages: uiMessages, plan: workingPlan }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { session: { id: string; title: string } };
        loadedSessionIdRef.current = data.session.id;
        setSessionId(data.session.id);
        setSessionTitle(data.session.title);
        router.replace(`/assistant?session=${data.session.id}`, { scroll: false });
        notifyChatSessionsChanged();
      } catch {
        // best-effort persistence — a dropped save just costs chat history, not the live chat
      }
      return;
    }

    setSessionTitle(title);
    try {
      const response = await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, messages: uiMessages, plan: workingPlan }),
      });
      if (response.ok) notifyChatSessionsChanged();
    } catch {
      // best-effort persistence
    }
  }

  // Autosave a beat after messages/plan settle — creates the session lazily on
  // the first turn and keeps saving as the chat and canvas edits progress.
  useEffect(() => {
    if (messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistSession();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, workingPlan]);

  function updateWorkingPlan(updater: (plan: OutreachPlan) => OutreachPlan) {
    setWorkingPlan((current) => (current ? updater(current) : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const activeEl = document.activeElement;
    shouldRefocusRef.current =
      activeEl === null || activeEl === document.body || (formRef.current?.contains(activeEl) ?? false);
    setInput("");
    setExecuteError("");
    setSessionStarted(true);
    await sendMessage({ text });
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function handleSuggestion(text: string) {
    if (busy) return;
    shouldRefocusRef.current = true;
    setExecuteError("");
    setSessionStarted(true);
    await sendMessage({ text });
  }

  async function handleApprove(current: OutreachPlan) {
    setApproving(true);
    setExecuteError("");
    setExecuteResult(null);
    try {
      const response = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: current }),
      });
      const data = await response.json();
      if (!response.ok) {
        setExecuteError(data.error ?? "Could not start the plan");
        return;
      }
      setExecuteResult(data.result as ExecuteResult);
      setStartedPlanKey(JSON.stringify(current));
    } catch {
      setExecuteError("Could not start the plan. Check your connection and API keys.");
    } finally {
      setApproving(false);
    }
  }

  function handleReset() {
    resetLocalState();
    loadedSessionIdRef.current = null;
    router.replace("/assistant", { scroll: false });
  }

  function handleOpenArtifact() {
    setPanelOpen(true);
  }

  function handleCloseArtifact() {
    setPanelOpen(false);
    setFullscreen(false);
  }

  async function handleCopyPlan() {
    if (!workingPlan) return;
    try {
      await navigator.clipboard.writeText(planToText(workingPlan));
      setCopied(true);
    } catch {
      // clipboard permission denied — silently ignore, Copy is a convenience action
    }
  }

  const enrollStatus: EnrollStatus = approving
    ? "running"
    : startedPlanKey === workingPlanKey && executeResult
      ? "done"
      : executeError
        ? "error"
        : "idle";

  const showHero = messages.length === 0 && !sessionStarted;
  const artifactTitle = workingPlan?.campaign.name || "Campaign plan";
  const artifactSubtitle = workingPlan
    ? `${workingPlan.campaign.steps.length} email step${workingPlan.campaign.steps.length === 1 ? "" : "s"} · ${
        enrollStatus === "done" ? "Started" : "Ready to review"
      }`
    : "";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
      {showHero ? (
        <section className="lf-rise grid shrink-0 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <h1 className="lf-display text-3xl font-semibold text-[var(--ink)] sm:text-4xl lg:text-5xl">
              Design the chase. Approve once. Run.
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)]">
              Tell Claude who you want and what you&apos;re offering. It drafts Apollo filters and a
              sequence — you confirm, then Leadflow enriches contacts and starts the campaign.
            </p>
          </div>
          <div className="lf-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Pipeline
            </h2>
            <ol className="mt-3 space-y-3 text-sm text-[var(--ink-soft)]">
              <li>
                <span className="font-semibold text-[var(--signal-deep)]">01</span> Chat constraints
              </li>
              <li>
                <span className="font-semibold text-[var(--signal-deep)]">02</span> Review the plan
                artifact
              </li>
              <li>
                <span className="font-semibold text-[var(--signal-deep)]">03</span> Approve → enrich +
                enroll
              </li>
            </ol>
          </div>
        </section>
      ) : null}

      <section
        ref={splitRef}
        className="lf-card flex min-h-0 w-full flex-1 overflow-hidden"
      >
        {chatVisible ? (
          <div
            style={artifactVisible ? { width: `${chatWidth}%`, flexShrink: 0 } : undefined}
            className={`flex min-h-0 flex-col ${artifactVisible ? "" : "flex-1"}`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">Studio chat</p>
              {sessionStarted || messages.length > 0 ? (
                <button type="button" className="lf-btn lf-btn-ghost" onClick={handleReset}>
                  New chat
                </button>
              ) : null}
            </div>

            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
              <div
                className={`mx-auto flex w-full flex-1 flex-col gap-1 ${artifactVisible ? "" : "max-w-3xl"}`}
              >
                {messages.length === 0 ? (
                  <div className="lf-rise my-auto space-y-4">
                    <p className="text-sm text-[var(--muted)]">Start with a target, or pick a spark:</p>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-2 text-left text-sm text-[var(--ink-soft)] transition hover:border-[var(--signal)] hover:text-[var(--ink)]"
                          onClick={() => handleSuggestion(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {messages.map((message) => {
                  const text = getMessageText(message as UIMessage);
                  const messagePlan = extractPlanFromMessage(message as UIMessage);
                  if (!text && !messagePlan && message.role === "assistant") {
                    // tool-only turn with nothing to show yet — skip empty bubble
                    return null;
                  }
                  const mine = message.role === "user";
                  return (
                    <div key={message.id} className="lf-rise flex flex-col gap-2 py-2">
                      {text ? (
                        <div className={mine ? "lf-msg-user" : "lf-msg-assistant"}>
                          <ChatMarkdown content={text} variant={mine ? "dark" : "light"} />
                        </div>
                      ) : null}

                      {messagePlan ? (
                        <button
                          type="button"
                          onClick={handleOpenArtifact}
                          className="lf-artifact-chip"
                        >
                          <span className="lf-artifact-chip-icon">
                            <DocumentIcon />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="lf-artifact-chip-title block">
                              {messagePlan.campaign.name || "Campaign plan"}
                            </span>
                            <span className="lf-artifact-chip-sub block">
                              {messagePlan.campaign.steps.length} email step
                              {messagePlan.campaign.steps.length === 1 ? "" : "s"} · Plan artifact
                            </span>
                          </span>
                          <span className="lf-artifact-chip-chevron">
                            <ChevronRightIcon />
                          </span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}

                {busy ? (
                  <div className="lf-typing mr-auto rounded-2xl px-1 py-3">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}

                {error ? (
                  <p className="lf-alert lf-alert-error">
                    {error.message.includes("ANTHROPIC")
                      ? "Add ANTHROPIC_API_KEY to your .env and restart the server."
                      : error.message}
                  </p>
                ) : null}
              </div>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-1">
              <div className={`mx-auto w-full ${artifactVisible ? "" : "max-w-3xl"}`}>
                <div className="lf-composer">
                  <textarea
                    ref={textareaRef}
                    className="lf-composer-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Describe the leads and campaign you want…"
                    rows={1}
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    className="lf-composer-send"
                    disabled={busy || !input.trim()}
                    aria-label="Send message"
                  >
                    <ArrowUpIcon />
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {artifactVisible && chatVisible ? (
          <div
            className={`lf-resizer ${resizing ? "is-active" : ""}`}
            onPointerDown={(event) => {
              event.preventDefault();
              setResizing(true);
            }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat and artifact panels"
          />
        ) : null}

        {artifactVisible ? (
          <div className="flex min-h-0 flex-1 flex-col lg:border-l lg:border-[var(--line)]">
            <div className="lf-artifact-header shrink-0 flex-wrap gap-y-2 sm:flex-nowrap">
              <span className="lf-artifact-header-icon">
                <DocumentIcon />
              </span>
              <div className="lf-artifact-header-meta">
                <p className="lf-artifact-header-eyebrow">Campaign plan</p>
                <p className="lf-artifact-header-title" title={artifactTitle}>
                  {artifactTitle}
                </p>
                <p className="lf-artifact-header-sub">{artifactSubtitle}</p>
              </div>

              {workingPlan ? (
                <button
                  type="button"
                  className="lf-btn lf-btn-primary shrink-0"
                  onClick={() => handleApprove(workingPlan)}
                  disabled={approving || enrollStatus === "done"}
                >
                  {enrollStatus === "done" ? "Started" : approving ? "Starting…" : "Approve & start"}
                </button>
              ) : null}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="lf-artifact-icon-btn"
                  onClick={handleCopyPlan}
                  aria-label="Copy plan"
                  title="Copy plan"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
                {isDesktop ? (
                  <button
                    type="button"
                    className="lf-artifact-icon-btn"
                    onClick={() => setFullscreen((f) => !f)}
                    aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                    title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {fullscreen ? <CollapseIcon /> : <ExpandIcon />}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="lf-artifact-icon-btn"
                  onClick={handleCloseArtifact}
                  aria-label="Close artifact"
                  title="Close"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              {workingPlan ? (
                <PlanArtifact
                  plan={workingPlan}
                  planVersion={planVersion}
                  onPlanChange={updateWorkingPlan}
                  enrollStatus={enrollStatus}
                  executeResult={executeResult}
                  onRunEnroll={() => handleApprove(workingPlan)}
                />
              ) : null}

              {executeResult ? (
                <div className="lf-card lf-rise shrink-0 border-[color-mix(in_srgb,var(--signal)_40%,var(--line))] p-4 text-sm text-[var(--ink-soft)]">
                  <p className="lf-chip">Run complete</p>
                  <p className="lf-display mt-2 text-xl font-semibold text-[var(--ink)]">
                    {executeResult.campaignName}
                  </p>
                  <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                    <li>Searched: {executeResult.searched}</li>
                    <li>Enriched: {executeResult.enriched}</li>
                    <li>Imported: {executeResult.imported}</li>
                    <li>Updated: {executeResult.updated}</li>
                    <li>Enrolled: {executeResult.enrolled}</li>
                    <li>Skipped (no email): {executeResult.skippedNoEmail}</li>
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link className="lf-btn lf-btn-primary" href={`/campaigns/${executeResult.campaignId}`}>
                      Open campaign
                    </Link>
                    <Link className="lf-btn lf-btn-ghost" href="/contacts">
                      View contacts
                    </Link>
                  </div>
                </div>
              ) : null}

              {executeError ? (
                <p className="lf-alert lf-alert-error shrink-0">{executeError}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="px-5 py-8 text-sm text-[var(--muted)]">Loading…</div>}>
      <AssistantStudio />
    </Suspense>
  );
}
