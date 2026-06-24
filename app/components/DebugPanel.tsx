import { useState, useEffect, useRef, useCallback } from "react";
import { X, Terminal, Trash2, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogLevel = "log" | "info" | "warn" | "error";
type LogEntry = {
  id: number;
  level: LogLevel;
  ts: string;
  args: string;
};

type NetEntry = {
  id: number;
  ts: string;
  method: string;
  url: string;
  status: number | null;
  duration: number | null;
  error?: string;
};

// ── Singleton log store (survives re-renders) ─────────────────────────────────

let _seq = 0;
const _logs: LogEntry[] = [];
const _net: NetEntry[]  = [];
const _subs = new Set<() => void>();

function notify() { _subs.forEach(fn => fn()); }

function installConsoleHook() {
  const levels: LogLevel[] = ["log", "info", "warn", "error"];
  levels.forEach(level => {
    const orig = console[level].bind(console);
    (console as any)[level] = (...args: unknown[]) => {
      orig(...args);
      _logs.push({
        id:    ++_seq,
        level,
        ts:    new Date().toLocaleTimeString(),
        args:  args.map(a => {
          try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); }
          catch { return String(a); }
        }).join(" "),
      });
      if (_logs.length > 200) _logs.shift();
      notify();
    };
  });
}

function installFetchHook() {
  const orig = window.fetch;
  window.fetch = async (input, init) => {
    const url    = typeof input === "string" ? input : (input as Request).url;
    const method = (init?.method ?? (typeof input === "string" ? "GET" : (input as Request).method ?? "GET")).toUpperCase();
    const id     = ++_seq;
    const ts     = new Date().toLocaleTimeString();
    const start  = Date.now();
    const entry: NetEntry = { id, ts, method, url, status: null, duration: null };
    _net.push(entry);
    if (_net.length > 100) _net.shift();
    notify();
    try {
      const res = await orig(input, init);
      entry.status   = res.status;
      entry.duration = Date.now() - start;
      notify();
      return res;
    } catch (e: any) {
      entry.error    = e.message;
      entry.duration = Date.now() - start;
      notify();
      throw e;
    }
  };
}

let _hooked = false;
function ensureHooks() {
  if (_hooked) return;
  _hooked = true;
  installConsoleHook();
  installFetchHook();
}

// ── Component ─────────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, string> = {
  log:   "text-zinc-300",
  info:  "text-sky-300",
  warn:  "text-amber-300",
  error: "text-red-400",
};

const STATUS_COLOR = (s: number | null) => {
  if (s === null) return "text-zinc-500";
  if (s < 300)    return "text-emerald-400";
  if (s < 400)    return "text-sky-400";
  if (s < 500)    return "text-amber-400";
  return "text-red-400";
};

export function DebugPanel({ isAdmin }: { isAdmin: boolean }) {
  const [open,    setOpen]    = useState(false);
  const [tab,     setTab]     = useState<"console" | "network">("console");
  const [, tick]              = useState(0);
  const [filter,  setFilter]  = useState("");
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  ensureHooks();

  // Subscribe to log updates
  useEffect(() => {
    const fn = () => tick(n => n + 1);
    _subs.add(fn);
    return () => { _subs.delete(fn); };
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (open && !minimized && tab === "console") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [_logs.length, open, minimized, tab]);

  if (!isAdmin) return null;

  const errorCount = _logs.filter(l => l.level === "error").length;
  const netErrorCount = _net.filter(n => n.error || (n.status !== null && n.status >= 400)).length;

  const filteredLogs = filter
    ? _logs.filter(l => l.args.toLowerCase().includes(filter.toLowerCase()))
    : _logs;

  const filteredNet = filter
    ? _net.filter(n => n.url.toLowerCase().includes(filter.toLowerCase()))
    : _net;

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:border-zinc-500 shadow-lg transition-colors"
        >
          <Terminal className="size-3.5" strokeWidth={1.75} />
          Debug
          {(errorCount + netErrorCount) > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
              {errorCount + netErrorCount}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className={`fixed bottom-0 right-0 left-0 z-50 bg-zinc-950 border-t border-zinc-700 shadow-2xl transition-all ${
            minimized ? "h-9" : "h-72"
          }`}
        >
          {/* Header */}
          <div className="flex items-center h-9 px-2 gap-3 border-b border-zinc-800 shrink-0">
            <Terminal className="size-3.5 text-zinc-400 shrink-0" strokeWidth={1.75} />
            <span className="text-xs font-semibold text-zinc-300">Debug</span>

            {/* Tabs */}
            {!minimized && (
              <div className="flex gap-0.5 ml-2">
                <TabBtn active={tab === "console"} onClick={() => setTab("console")}>
                  Console {errorCount > 0 && <Badge n={errorCount} />}
                </TabBtn>
                <TabBtn active={tab === "network"} onClick={() => setTab("network")}>
                  Network {netErrorCount > 0 && <Badge n={netErrorCount} />}
                </TabBtn>
              </div>
            )}

            {/* Filter */}
            {!minimized && (
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter…"
                className="ml-2 h-5 px-2 text-[11px] bg-zinc-900 border border-zinc-700 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 w-40"
              />
            )}

            <div className="ml-auto flex items-center gap-1">
              {!minimized && (
                <button
                  onClick={() => { _logs.length = 0; _net.length = 0; tick(n => n + 1); }}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Clear"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
              <button
                onClick={() => setMinimized(v => !v)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {minimized
                  ? <ChevronUp className="size-3.5" strokeWidth={1.75} />
                  : <ChevronDown className="size-3.5" strokeWidth={1.75} />
                }
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!minimized && (
            <div className="overflow-y-auto h-[calc(100%-2.25rem)] font-mono text-[11px]">
              {tab === "console" ? (
                <div className="p-2 space-y-0.5">
                  {filteredLogs.length === 0
                    ? <p className="text-zinc-600 p-2">No logs yet.</p>
                    : filteredLogs.map(l => (
                      <div key={l.id} className="flex gap-2 items-start hover:bg-zinc-900/50 px-1 py-0.5 rounded">
                        <span className="text-zinc-600 shrink-0 w-16">{l.ts}</span>
                        <span className={`shrink-0 w-10 uppercase text-[10px] font-bold ${LEVEL_STYLE[l.level]}`}>{l.level}</span>
                        <span className={`whitespace-pre-wrap break-all ${LEVEL_STYLE[l.level]}`}>{l.args}</span>
                      </div>
                    ))
                  }
                  <div ref={bottomRef} />
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {filteredNet.length === 0
                    ? <p className="text-zinc-600 p-2">No requests yet.</p>
                    : [...filteredNet].reverse().map(n => (
                      <div key={n.id} className="flex gap-2 items-start hover:bg-zinc-900/50 px-1 py-0.5 rounded">
                        <span className="text-zinc-600 shrink-0 w-16">{n.ts}</span>
                        <span className="shrink-0 w-10 text-zinc-400 font-bold">{n.method}</span>
                        <span className={`shrink-0 w-8 font-bold ${STATUS_COLOR(n.status)}`}>
                          {n.status ?? (n.error ? "ERR" : "…")}
                        </span>
                        <span className="text-zinc-400 truncate flex-1" title={n.url}>{n.url}</span>
                        {n.duration !== null && (
                          <span className="text-zinc-600 shrink-0">{n.duration}ms</span>
                        )}
                        {n.error && (
                          <span className="text-red-400 shrink-0 truncate max-w-xs">{n.error}</span>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] transition-colors ${
        active ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="px-1 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold leading-none">
      {n}
    </span>
  );
}
