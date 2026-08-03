"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type ChatMarkdownProps = {
  content: string;
  variant?: "light" | "dark";
};

export function ChatMarkdown({ content, variant = "light" }: ChatMarkdownProps) {
  const dark = variant === "dark";

  return (
    <div className={`lf-chat-md ${dark ? "lf-chat-md--dark" : "lf-chat-md--light"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="lf-chat-md-p">{children}</p>,
          ul: ({ children }) => <ul className="lf-chat-md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="lf-chat-md-ol">{children}</ol>,
          li: ({ children }) => <li className="lf-chat-md-li">{children}</li>,
          strong: ({ children }) => <strong className="lf-chat-md-strong">{children}</strong>,
          em: ({ children }) => <em className="lf-chat-md-em">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="lf-chat-md-a"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const inline = !className;
            if (inline) {
              return <code className="lf-chat-md-code">{children}</code>;
            }
            return <code className={`lf-chat-md-code-block ${className ?? ""}`}>{children}</code>;
          },
          pre: ({ children }) => <pre className="lf-chat-md-pre">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="lf-chat-md-blockquote">{children}</blockquote>
          ),
          h1: ({ children }) => <h3 className="lf-chat-md-h">{children}</h3>,
          h2: ({ children }) => <h3 className="lf-chat-md-h">{children}</h3>,
          h3: ({ children }) => <h3 className="lf-chat-md-h">{children}</h3>,
          hr: () => <hr className="lf-chat-md-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
