"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_HISTORY, MAX_MESSAGE_LENGTH, type ChatErrorCode, type ChatToolName } from "@/lib/chat/config";

/**
 * The conversation, and the reader that fills it in.
 *
 * `/api/chat` streams newline-delimited JSON. A chunk from the network is not
 * guaranteed to end on a newline, so the tail of each chunk is held back until
 * the rest of its line arrives — parsing eagerly would throw on a frame split
 * across two packets, which is exactly the kind of bug that only appears on a
 * slow connection.
 */

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string };

export type ChatStatus =
  /** Nothing in flight. */
  | "idle"
  /** Request sent, no text back yet. */
  | "waiting"
  /** Text is arriving. */
  | "streaming";

function newId() {
  return Math.random().toString(36).slice(2);
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  /** Which lookup is running, for the status line. */
  const [activity, setActivity] = useState<ChatToolName | null>(null);
  const [error, setError] = useState<ChatErrorCode | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Read inside `send` so the request carries the history as it is at that
  // moment — a state variable captured in the closure would be one turn stale.
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // A conversation still streaming when the page navigates away would keep the
  // connection open and keep costing tokens for an answer nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setActivity(null);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setStatus("idle");
    setActivity(null);
    setError(null);
  }, []);

  const send = useCallback(async (input: string) => {
    const text = input.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const history = [...messagesRef.current, { id: newId(), role: "user" as const, content: text }];
    const replyId = newId();

    setError(null);
    setActivity(null);
    setStatus("waiting");
    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);

    const appendToReply = (chunk: string) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === replyId ? { ...message, content: message.content + chunk } : message,
        ),
      );
    };

    /** Drops the placeholder bubble so a failure doesn't leave an empty one. */
    const failWith = (code: ChatErrorCode) => {
      setError(code);
      setMessages((current) =>
        current.filter((message) => !(message.id === replyId && message.content === "")),
      );
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history
            .slice(-MAX_HISTORY)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        const code = (payload as { error?: ChatErrorCode } | null)?.error;
        failWith(code ?? "failed");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let event: { type?: string; value?: string; name?: ChatToolName; code?: ChatErrorCode };
        try {
          event = JSON.parse(trimmed);
        } catch {
          // A frame we can't read is not worth killing the answer over.
          return;
        }

        switch (event.type) {
          case "text":
            if (event.value) {
              setStatus("streaming");
              setActivity(null);
              appendToReply(event.value);
            }
            break;
          case "tool":
            if (event.name) setActivity(event.name);
            break;
          case "error":
            failWith(event.code ?? "failed");
            break;
          default:
            break;
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Everything up to the last newline is whole; the remainder waits.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }

      // `stream: true` may be holding a partial multi-byte character.
      buffer += decoder.decode();
      if (buffer.trim()) handleLine(buffer);
    } catch (cause) {
      // Aborting is the user pressing stop or leaving — not an error to show.
      if ((cause as { name?: string })?.name !== "AbortError") failWith("failed");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStatus("idle");
      setActivity(null);
    }
  }, []);

  return { messages, status, activity, error, send, stop, reset };
}
