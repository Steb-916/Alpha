/**
 * Phase 7: tiny dependency-free markdown renderer.
 *
 * Supports a deliberately small subset of markdown — enough to render the
 * Phase 7 legal pages (terms, privacy, analyst agreement) without pulling
 * in @next/mdx, marked, or react-markdown.
 *
 * Supported syntax:
 *   # H1, ## H2, ### H3
 *   - bullet list, 1. ordered list (any digit)
 *   **bold**, *italic*
 *   <!-- comments --> (stripped silently)
 *   blank line → paragraph break
 *   plain text → <p>
 */

import React from "react";

interface Props {
  content: string;
}

function inline(text: string, key: number): React.ReactNode {
  // Process **bold** then *italic*. Order matters because ** contains *.
  const nodes: React.ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  parts.forEach((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(<strong key={`${key}-b-${i}`}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      nodes.push(<em key={`${key}-i-${i}`}>{part.slice(1, -1)}</em>);
    } else if (part.length > 0) {
      nodes.push(<React.Fragment key={`${key}-t-${i}`}>{part}</React.Fragment>);
    }
  });
  return nodes;
}

export function MarkdownRenderer({ content }: Props) {
  // Strip HTML comments before tokenization.
  const cleaned = content.replace(/<!--[\s\S]*?-->/g, "").trim();
  const lines = cleaned.split("\n");

  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — separator
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      out.push(
        <h3
          key={key++}
          className="font-bold font-display mt-6 mb-2 text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          {inline(line.slice(4), key++)}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2
          key={key++}
          className="font-bold font-display mt-8 mb-3 text-xl"
          style={{ color: "var(--text-primary)" }}
        >
          {inline(line.slice(3), key++)}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h1
          key={key++}
          className="font-bold font-display mb-4 text-3xl"
          style={{ color: "var(--text-primary)" }}
        >
          {inline(line.slice(2), key++)}
        </h1>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul
          key={key++}
          className="list-disc pl-6 space-y-1 my-3 text-sm font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          {items.map((it, j) => (
            <li key={j}>{inline(it, key++)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol
          key={key++}
          className="list-decimal pl-6 space-y-1 my-3 text-sm font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          {items.map((it, j) => (
            <li key={j}>{inline(it, key++)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Plain paragraph
    out.push(
      <p
        key={key++}
        className="text-sm font-body my-3 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {inline(line, key++)}
      </p>,
    );
    i++;
  }

  return <div>{out}</div>;
}
