import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

const MAX_ROUNDS = 5;

// Keep the last few conversation turns, always starting at a plain user message
// so tool requests and their results stay together.
function trimHistory(messages, turns = 8) {
  const starts = messages
    .map((m, i) => (m.role === 'user' && typeof m.content === 'string' ? i : -1))
    .filter((i) => i >= 0);
  if (starts.length <= turns) return messages;
  return messages.slice(starts[starts.length - turns]);
}

async function callAssistant(messages, context) {
  const { data, error } = await supabase.functions.invoke('assistant', { body: { messages, context } });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      // keep the default message
    }
    if (/Failed to send|not found|404/i.test(message)) {
      message = 'The assistant isn’t set up yet. Deploy the “assistant” function in Supabase.';
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function Assistant({ getContext, runTool }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]); // messages in API format
  const [bubbles, setBubbles] = useState([
    {
      role: 'assistant',
      text: 'Hi! Ask me about your lists or tell me what to do, like “add milk and eggs from Costco for Ana” or “what’s left to buy?”',
    },
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [bubbles, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setBubbles((b) => [...b, { role: 'user', text }]);

    let messages = [...history, { role: 'user', content: text }];
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const data = await callAssistant(messages, getContext());
        const content = data.content || [];
        messages = [...messages, { role: 'assistant', content }];

        const reply = content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        if (reply) setBubbles((b) => [...b, { role: 'assistant', text: reply }]);

        const uses = content.filter((b) => b.type === 'tool_use');
        if (!uses.length || data.stop_reason !== 'tool_use') break;

        const results = [];
        for (const use of uses) {
          let output;
          try {
            output = await runTool(use.name, use.input || {});
            setBubbles((b) => [...b, { role: 'action', text: output }]);
          } catch (err) {
            output = `Error: ${err.message}`;
          }
          results.push({ type: 'tool_result', tool_use_id: use.id, content: String(output).slice(0, 8000) });
        }
        messages = [...messages, { role: 'user', content: results }];
      }
      setHistory(trimHistory(messages));
    } catch (err) {
      setBubbles((b) => [...b, { role: 'error', text: err.message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={open ? 'assistant-fab open' : 'assistant-fab'}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        +
      </button>

      {open && (
        <section className="assistant-panel" aria-label="Assistant">
          <div className="assistant-head">
            <strong>Assistant</strong>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                setHistory([]);
                setBubbles((b) => b.slice(0, 1));
              }}
            >
              New chat
            </button>
          </div>
          <div className="assistant-messages" aria-live="polite">
            {bubbles.map((b, i) => (
              <div key={i} className={`bubble ${b.role}`}>
                {b.text}
              </div>
            ))}
            {busy && <div className="bubble assistant typing">…</div>}
            <div ref={endRef} />
          </div>
          <form className="assistant-input" onSubmit={send}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or tell me what to do…"
              aria-label="Message the assistant"
              autoFocus
            />
            <button type="submit" className="next-btn primary" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
