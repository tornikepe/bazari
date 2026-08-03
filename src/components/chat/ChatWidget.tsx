"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { ChatMessageText } from "@/components/chat/ChatMessageText";
import { useChatStream } from "@/components/chat/useChatStream";
import { MAX_MESSAGE_LENGTH, type ChatToolName } from "@/lib/chat/config";
import { ChatIcon, CloseIcon, SendIcon, TrashIcon } from "@/components/ui/icons";

/**
 * The contact assistant, as a panel anchored to the corner of the storefront.
 *
 * Rendered only when the server says a key is configured — `available` comes
 * down from the layout as a prop rather than being probed with a request, so
 * an unconfigured deployment shows no launcher at all instead of a button that
 * fails when pressed.
 *
 * The conversation is deliberately not persisted anywhere: closing the panel
 * keeps it for the session, reloading the page starts fresh. Storing it would
 * mean keeping someone's order numbers in `localStorage` for the next person
 * to use the same browser.
 */
export function ChatWidget({ available }: { available: boolean }) {
  const { t } = useI18n();
  const { messages, status, activity, error, send, stop, reset } = useChatStream();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** False once the visitor scrolls up — auto-scroll must not fight them. */
  const pinnedRef = useRef(true);

  const busy = status !== "idle";

  /* -------------------------------------------------------------- */
  /* Open / close                                                    */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      // Returning focus to the launcher keeps keyboard users where they were,
      // rather than dropping them at the top of the document.
      launcherRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /* -------------------------------------------------------------- */
  /* Scrolling                                                       */
  /* -------------------------------------------------------------- */

  // Layout effect, not effect: scrolling after paint shows one frame of the
  // old position on every token, which reads as a flicker while streaming.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !pinnedRef.current) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, activity, open]);

  function onListScroll() {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    pinnedRef.current = distanceFromBottom < 48;
  }

  /* -------------------------------------------------------------- */
  /* Sending                                                         */
  /* -------------------------------------------------------------- */

  function submit(text: string) {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    pinnedRef.current = true;
    setDraft("");
    void send(trimmed);
    inputRef.current?.focus();
  }

  const errorText = error
    ? {
        rate_limited: t.chat.errorRateLimited,
        budget_exhausted: t.chat.errorBudget,
        unavailable: t.chat.errorUnavailable,
        bad_request: t.chat.errorFailed,
        failed: t.chat.errorFailed,
      }[error]
    : null;

  const activityText: Record<ChatToolName, string> = {
    search_products: t.chat.toolSearchProducts,
    get_product: t.chat.toolGetProduct,
    list_categories: t.chat.toolListCategories,
    lookup_order: t.chat.toolLookupOrder,
  };

  const suggestions = [t.chat.suggestion1, t.chat.suggestion2, t.chat.suggestion3];

  if (!available) return null;

  return (
    <div className="chat-root">
      {/* ---------------------------------------------------------- */}
      {/* Panel                                                       */}
      {/* ---------------------------------------------------------- */}
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-label={t.chat.title}
          className="chat-panel card flex flex-col overflow-hidden shadow-pop"
        >
          <header className="flex shrink-0 items-center gap-2.5 bg-panel px-3.5 py-3 text-panel-fg">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-brand-600 text-white">
              <ChatIcon size={17} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{t.chat.title}</p>
              <p className="truncate text-xs text-panel-muted">{t.chat.subtitle}</p>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                aria-label={t.chat.clear}
                title={t.chat.clear}
                className="chat-header-btn"
              >
                <TrashIcon size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.chat.close}
              className="chat-header-btn"
            >
              <CloseIcon size={17} />
            </button>
          </header>

          <div
            ref={listRef}
            onScroll={onListScroll}
            role="log"
            aria-live="polite"
            aria-atomic="false"
            className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain bg-canvas px-3.5 py-3.5"
          >
            {/* The greeting is markup, not a model turn: it costs nothing and
                it is on screen before the first request is ever made. */}
            <div className="chat-bubble chat-bubble-assistant">{t.chat.greeting}</div>

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="chat-bubble chat-bubble-user">
                  {message.content}
                </div>
              ) : (
                message.content && (
                  <div key={message.id} className="chat-bubble chat-bubble-assistant">
                    <ChatMessageText text={message.content} />
                  </div>
                )
              ),
            )}

            {busy && (
              <p className="flex items-center gap-2 px-1 text-xs text-ink-500">
                <span className="chat-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {activity ? activityText[activity] : t.chat.thinking}
              </p>
            )}

            {errorText && (
              <p role="alert" className="chat-bubble bg-danger-soft text-danger">
                {errorText}
              </p>
            )}

            {messages.length === 0 && !busy && (
              <div className="mt-1 flex flex-col gap-1.5">
                <p className="px-1 text-xs font-semibold text-ink-400">
                  {t.chat.suggestionsLabel}
                </p>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => submit(suggestion)}
                    className="chat-suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-line bg-surface px-3 py-2.5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
              className="flex items-end gap-2"
            >
              <label className="sr-only" htmlFor={`${panelId}-input`}>
                {t.chat.placeholder}
              </label>
              <textarea
                id={`${panelId}-input`}
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={t.chat.placeholder}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter is a newline. Not while the IME
                  // is composing, or Georgian input would send mid-word.
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submit(draft);
                  }
                }}
                className="chat-input"
              />

              {busy ? (
                <button
                  type="button"
                  onClick={stop}
                  aria-label={t.chat.stop}
                  className="chat-send bg-ink-200 text-ink-700"
                >
                  <span className="chat-stop-glyph" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label={t.chat.send}
                  className="chat-send bg-brand-600 text-white disabled:bg-ink-200 disabled:text-ink-400"
                >
                  <SendIcon size={17} />
                </button>
              )}
            </form>

            <p className="mt-1.5 text-center text-xs text-ink-400">{t.chat.disclaimer}</p>
          </footer>
        </section>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Launcher                                                    */}
      {/* ---------------------------------------------------------- */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? t.chat.close : t.chat.launch}
        className="chat-launcher"
      >
        {open ? <CloseIcon size={20} /> : <ChatIcon size={20} />}
        {/* The label follows the icon — a cross next to the word "Help" reads
            as a button that dismisses help rather than one that closes the
            panel. */}
        <span className="chat-launcher-label">{open ? t.chat.close : t.chat.launch}</span>
      </button>
    </div>
  );
}
