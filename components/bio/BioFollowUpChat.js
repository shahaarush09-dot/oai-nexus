"use client";

import { useEffect, useRef, useState } from "react";

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-400 [animation-delay:-0.32s]" />
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-400 [animation-delay:-0.16s]" />
      <span className="h-2 w-2 animate-pulseDot rounded-full bg-slate-400" />
    </div>
  );
}

export default function BioFollowUpChat({ report, conversationId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/bio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          report,
          messages: nextMessages,
          conversationId,
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Rate limit reached. Please try again later.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-slate-900">
        Ask a follow-up question about this report
      </h3>
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="flex max-h-80 flex-col gap-4 overflow-y-auto p-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-gold text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.role === "user" ? (
                    <p>{m.content}</p>
                  ) : (
                    <div className="prose-chat">
                      {m.content.split(/\n\n+/).map((para, j) => (
                        <p key={j}>{para}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-slate-100 px-4 py-3">
                  <ThinkingIndicator />
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="border-t border-slate-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 border-t border-slate-200 p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about the report..."
            rows={2}
            className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-gold"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 shrink-0 rounded-md bg-gold px-4 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
