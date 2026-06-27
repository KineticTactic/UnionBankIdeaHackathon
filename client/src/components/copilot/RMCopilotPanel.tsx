'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, ChevronDown, Bot, Wrench } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface Props {
  customerId: string;
  customerName: string;
  rmUserId?: string;
}

const COMPASS_BASE = process.env.NEXT_PUBLIC_COMPASS_URL || 'http://localhost:8004';

export function RMCopilotPanel({ customerId, customerName, rmUserId = 'rm-demo' }: Props) {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Reset when customer changes
  useEffect(() => {
    setMessages([]);
    setSessionId(undefined);
    setInput('');
  }, [customerId]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${COMPASS_BASE}/copilot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          rm_user_id: rmUserId,
          customer_id: customerId,
          message: text,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setSessionId(data.session_id);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        toolsUsed: data.tools_used,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e instanceof Error ? e.message : 'Request failed'}. Check that the COMPASS service is running.`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const QUICK_PROMPTS = [
    'Why is this customer at risk?',
    'What offer should I lead with?',
    `Has ${customerName.split(' ')[0]} had any life events recently?`,
    'What channel has best response rate for this segment?',
  ];

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0f2d5c] text-white px-4 py-3 rounded-full shadow-xl hover:bg-[#1a3f7a] transition-all duration-200 group"
        aria-label="RM Copilot"
      >
        <Bot className="w-5 h-5" />
        <span className="text-[13px] font-semibold pr-1">RM Copilot</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[420px] max-h-[580px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#0f2d5c] text-white shrink-0">
            <Bot className="w-5 h-5 opacity-80" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-tight">RM Copilot</p>
              <p className="text-[10px] opacity-60 truncate">Customer: {customerName} · {customerId}</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[12px] text-slate-400 text-center py-2">
                  Ask me anything about this customer — I can check scores, signals, offers, history, and playbooks.
                </p>
                <div className="space-y-1.5">
                  {QUICK_PROMPTS.map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="w-full text-left text-[12px] text-slate-600 px-3 py-2 rounded-lg border border-slate-200 hover:border-[#0f2d5c] hover:text-[#0f2d5c] hover:bg-blue-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${msg.role === 'user' ? '' : 'space-y-1.5'}`}>
                  <div
                    className={`px-3 py-2.5 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#0f2d5c] text-white rounded-br-sm'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-1">
                      {msg.toolsUsed.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          <Wrench className="w-2.5 h-2.5" />
                          {t.replace(/_tool$/, '').replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-slate-100 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about this customer…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0f2d5c] focus:ring-2 focus:ring-[#0f2d5c]/10 transition-colors max-h-28 overflow-y-auto"
                style={{ lineHeight: '1.4' }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#0f2d5c] text-white hover:bg-[#1a3f7a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-slate-300 mt-1.5 text-center">Enter to send · Shift+Enter for new line · [LLM:1 per turn]</p>
          </div>
        </div>
      )}
    </>
  );
}
