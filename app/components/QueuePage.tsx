import { useState, useEffect } from "react";
import { Download, RefreshCw, X, Play } from "lucide-react";
import { getQueue, removeQueueItem, QueueItem } from "../lib/store";

type FilterTab = "all" | "rendering" | "queued" | "done" | "failed";

export function QueuePage() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<QueueItem[]>(() => getQueue());

  useEffect(() => {
    const hasActive = items.some(i => i.status === "rendering" || i.status === "queued");
    if (!hasActive) return;
    const id = setInterval(() => setItems(getQueue()), 1500);
    return () => clearInterval(id);
  }, [items]);

  const filtered = items.filter(r => filter === "all" || r.status === filter);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const handleCancel = (id: string) => {
    setItems(removeQueueItem(id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleDownload = (item: QueueItem) => {
    if (item.resultUrl) window.open(item.resultUrl, "_blank");
  };

  const handleBulkDownload = () => {
    filtered.filter(r => selected.has(r.id) && r.status === "done" && r.resultUrl).forEach(r => window.open(r.resultUrl, "_blank"));
  };

  const counts = {
    all: items.length,
    rendering: items.filter(r => r.status === "rendering").length,
    queued: items.filter(r => r.status === "queued").length,
    done: items.filter(r => r.status === "done").length,
    failed: items.filter(r => r.status === "failed").length,
  };

  const creditsUsed = items.filter(r => r.status === "done").reduce((s, r) => s + r.credits, 0);
  const doneSelected = filtered.filter(r => selected.has(r.id) && r.status === "done");

  const StatusBadge = ({ s, progress }: { s: QueueItem["status"]; progress?: number }) => {
    if (s === "rendering") return <span className="inline-flex items-center gap-1.5 text-xs text-accent"><span className="size-1.5 rounded-full bg-accent pulse-dot" />{progress ?? 0}%</span>;
    if (s === "queued")    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-muted-foreground/40" />Queued</span>;
    if (s === "done")      return <span className="inline-flex items-center gap-1.5 text-xs text-foreground"><span className="size-1.5 rounded-full bg-foreground" />Done</span>;
    return                          <span className="inline-flex items-center gap-1.5 text-xs text-destructive"><span className="size-1.5 rounded-full bg-destructive" />Failed</span>;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Rendering", value: counts.rendering, dot: "bg-accent pulse-dot" },
            { label: "Queued", value: counts.queued, dot: "bg-muted-foreground/40" },
            { label: "Completed", value: counts.done, dot: "bg-foreground" },
            { label: "Credits used", value: creditsUsed, dot: "bg-muted-foreground/30" },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-card border border-border p-4 flex items-center gap-3">
              <span className={`size-2 rounded-full shrink-0 ${s.dot}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold tracking-tight mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {(["all", "rendering", "queued", "done", "failed"] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`h-8 px-3 rounded-md text-sm transition-colors flex items-center gap-1.5 capitalize ${
                  filter === tab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"
                }`}
              >
                {tab}
                <span className="text-xs text-muted-foreground/70">{counts[tab]}</span>
              </button>
            ))}
          </div>
          {doneSelected.length > 0 && (
            <button onClick={handleBulkDownload} className="h-8 px-3 rounded-md bg-foreground text-background text-sm font-medium flex items-center gap-1.5">
              <Download className="size-3.5" strokeWidth={2} />
              Download {doneSelected.length}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[40px_56px_1fr_120px_120px_72px_88px_56px] items-center bg-card border-b border-border px-3 h-9 gap-2">
            <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="accent-[var(--accent)] cursor-pointer" />
            <div />
            <p className="text-xs text-muted-foreground">Render</p>
            <p className="text-xs text-muted-foreground">Model</p>
            <p className="text-xs text-muted-foreground">Athlete</p>
            <p className="text-xs text-muted-foreground">Cost</p>
            <p className="text-xs text-muted-foreground">Status</p>
            <div />
          </div>

          {filtered.length === 0 && (
            <div className="px-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">No renders yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Generate from the Studio to see them here</p>
            </div>
          )}

          {filtered.map((item, i) => (
            <div
              key={item.id}
              className={`grid grid-cols-[40px_56px_1fr_120px_120px_72px_88px_56px] items-center px-3 gap-2 group transition-colors ${
                selected.has(item.id) ? "bg-secondary" : "hover:bg-card"
              } ${i < filtered.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="py-3"><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="accent-[var(--accent)] cursor-pointer" /></div>
              <div className="py-2">
                <div className="size-10 rounded-md bg-card overflow-hidden relative">
                  {(item.thumb || item.resultUrl) && <img src={item.resultUrl ?? item.thumb} alt="" className="w-full h-full object-cover" />}
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Play className="size-3 text-foreground" fill="currentColor" />
                    </div>
                  )}
                </div>
              </div>
              <div className="py-3 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.startedAt}</p>
                {item.status === "rendering" && item.progress !== undefined && (
                  <div className="mt-1.5 h-px bg-border w-full max-w-[200px] overflow-hidden">
                    <div className="h-full bg-accent transition-all duration-500" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
                {item.error && <p className="text-xs text-destructive mt-1 truncate">{item.error}</p>}
              </div>
              <p className="text-sm text-muted-foreground truncate">{item.model}</p>
              <p className="text-sm text-muted-foreground truncate">{item.athleteName}</p>
              <p className="text-sm text-muted-foreground">{item.credits > 0 ? `${item.credits}cr` : "—"}</p>
              <div><StatusBadge s={item.status} progress={item.progress} /></div>
              <div className="py-3 flex items-center justify-end gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
                {item.status === "done" && (
                  <button onClick={() => handleDownload(item)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground" title="Download">
                    <Download className="size-3.5" strokeWidth={1.75} />
                  </button>
                )}
                {item.status === "failed" && (
                  <button onClick={() => handleCancel(item.id)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary text-destructive" title="Remove">
                    <RefreshCw className="size-3.5" strokeWidth={1.75} />
                  </button>
                )}
                {(item.status === "queued" || item.status === "rendering") && (
                  <button onClick={() => handleCancel(item.id)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground" title="Cancel">
                    <X className="size-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
