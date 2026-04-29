"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "What's the best time of year to visit?",
  "What should I pack for this trip?",
  "Any local customs I should know?",
  "What are the must-eat dishes?",
];

export function ChatPanel() {
  const { trip, chatMessages, addMessage } = useTripStore();
  const [input,   setInput  ] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Welcome message on first load
  const hasMessages = chatMessages.length > 0;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    addMessage({ role: "user", content: trimmed, stepContext: trip.currentStep });
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: chatMessages,
          preferences: trip.preferences,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      addMessage({ role: "assistant", content: data.reply, stepContext: trip.currentStep });
    } catch {
      addMessage({
        role: "assistant",
        content: "Sorry, I had trouble connecting. Please try again.",
        stepContext: trip.currentStep,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 hidden lg:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
            <Sparkles size={13} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">AI Travel Advisor</p>
            <p className="text-xs text-slate-400">Ask me anything about your trip</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {/* Welcome */}
        {!hasMessages && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Sparkles size={20} className="text-brand-500" />
            </div>
            <div>
              <p className="font-medium text-slate-800 text-sm">Your AI travel advisor</p>
              <p className="text-xs text-slate-500 mt-1">
                I know your destination and preferences. Ask me anything.
              </p>
            </div>
            <div className="w-full mt-2 flex flex-col gap-1.5">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 text-left hover:bg-slate-100 hover:border-slate-300 transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2 animate-fade-up",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                msg.role === "user"
                  ? "bg-slate-200 text-slate-600"
                  : "bg-brand-100 text-brand-600"
              )}
            >
              {msg.role === "user"
                ? <User size={11} />
                : <Sparkles size={11} />
              }
            </div>

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-tr-sm"
                  : "bg-slate-100 text-slate-700 rounded-tl-sm"
              )}
            >
              {msg.role === "assistant"
                ? <div className="prose-chat" dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }} />
                : msg.content
              }
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2 animate-fade-up">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 mt-0.5">
              <Sparkles size={11} />
            </div>
            <div className="flex items-center gap-1 rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your travel advisor…"
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 max-h-32"
            style={{ minHeight: "38px" }}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Minimal markdown → HTML converter for chat responses
function markdownToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[a-z])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
