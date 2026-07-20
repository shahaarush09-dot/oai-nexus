"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { generateUUID } from "@/lib/generateUUID";

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate-400 [animation-delay:-0.32s]" />
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate-400 [animation-delay:-0.16s]" />
      <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-slate-400" />
    </div>
  );
}

const bubbleVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function MessageBubble({ role, content, theme }) {
  const isUser = role === "user";
  const isSystem = role === "system";

  if (isSystem) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
        className="flex justify-start"
      >
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm leading-relaxed text-slate-500 sm:max-w-[70%]">
          <p>{content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={bubbleVariants}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
          isUser
            ? `${theme.userBubble} rounded-2xl rounded-br-md text-white`
            : `${theme.aiWash} rounded-2xl rounded-bl-md border ${theme.aiBorder} text-slate-800`
        }`}
      >
        {isUser ? (
          <p>{content}</p>
        ) : (
          <div className="prose-chat">
            {content.split(/\n\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ChatInterface({
  apiPath,
  examples = [],
  theme,
  placeholder = "Type your question...",
  disclaimer,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const conversationIdRef = useRef(null);
  if (!conversationIdRef.current) {
    conversationIdRef.current = generateUUID();
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    requestAnimationFrame(resizeTextarea);

    const apiMessages = nextMessages.filter((m) => m.role !== "system");

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          conversationId: conversationIdRef.current,
        }),
      });

      if (res.status === 429 || res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setMessages([
          ...nextMessages,
          {
            role: "system",
            content: data.error || "Something went wrong. Please try again.",
          },
        ]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      const data = await res.json();
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply },
      ]);
    } catch (e) {
      setMessages([
        ...nextMessages,
        { role: "system", content: e.message || "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  const hasMessages = messages.length > 0 || loading;

  return (
    <div className="flex w-full flex-col">
      {!hasMessages ? (
        <div className="flex min-h-[38vh] flex-col items-center justify-center gap-6 px-4 text-center sm:min-h-[44vh]">
          <p className="text-sm text-slate-400">Ask a question to get started.</p>
          <div className="flex max-w-xl flex-wrap justify-center gap-2">
            {examples.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className={`rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-colors ${theme.chipHover}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex h-[58vh] flex-col gap-3 overflow-y-auto px-1 py-4 sm:h-[64vh]"
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} content={m.content} theme={theme} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl rounded-bl-md border ${theme.aiBorder} ${theme.aiWash} px-3 py-2`}>
                <LoadingDots />
              </div>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 rounded-3xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all ${theme.ring}`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="max-h-[120px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send message"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all disabled:bg-slate-200 disabled:text-slate-400 ${theme.sendBg}`}
        >
          <SendIcon />
        </button>
      </form>

      {disclaimer && (
        <p className="mt-3 text-center text-xs text-slate-400">{disclaimer}</p>
      )}
    </div>
  );
}
