"use client";

import Link from "next/link";
import { Fragment } from "react";
import { splitLinks } from "@/lib/chat/links";

/**
 * Assistant text, with site paths turned into links.
 *
 * The matching — and the allowlist that keeps it to routes this app actually
 * has — lives in `@/lib/chat/links`; this component only renders the result.
 */
export function ChatMessageText({ text }: { text: string }) {
  // Explicit <br /> rather than `white-space: pre-wrap`, so the bubble doesn't
  // also preserve leading spaces the model happens to emit while streaming.
  return (
    <>
      {text.split("\n").map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {splitLinks(line).map((segment, index) =>
            segment.type === "link" ? (
              <Link
                key={index}
                href={segment.href}
                className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500"
              >
                {segment.href}
              </Link>
            ) : (
              <Fragment key={index}>{segment.value}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}
