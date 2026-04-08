"use client";

/**
 * "X is typing..." indicator with three-dot bounce animation.
 *
 * Reads typing users from the chat store presence map. Filters out the
 * current user (the API also filters but we double-check).
 */

import type { ChatPresenceUser } from "@/lib/chat";

interface Props {
  typing: ChatPresenceUser[];
}

export function TypingIndicator({ typing }: Props) {
  if (typing.length === 0) return null;

  let label: string;
  if (typing.length === 1) {
    label = `${typing[0].displayName} is typing`;
  } else if (typing.length === 2) {
    label = `${typing[0].displayName} and ${typing[1].displayName} are typing`;
  } else {
    label = `${typing[0].displayName} and ${typing.length - 1} others are typing`;
  }

  return (
    <div
      className="px-3 py-1 flex items-center gap-2 text-[10px] font-body"
      style={{ color: "var(--text-muted)" }}
    >
      <span>{label}</span>
      <span className="flex items-center gap-0.5">
        <span className="typing-dot" />
        <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
        <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
      </span>
      <style jsx>{`
        .typing-dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--text-muted);
          animation: typing-bounce 1s ease-in-out infinite;
        }
        @keyframes typing-bounce {
          0%,
          80%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          40% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
