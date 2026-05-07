import { useEffect, useState } from "react";
import { X, MoreVertical, Download, Copy, RotateCcw, Trash2, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { getQueue, getCredits, removeQueueItem, QueueItem } from "../lib/store";

interface RenderQueueProps {
  onClose: () => void;
}

export function RenderQueue({ onClose }: RenderQueueProps) {
  const [items, setItems] = useState<QueueItem[]>(() => getQueue());
  const [credits, setCredits] = useState<number>(() => getCredits());

  useEffect(() => {
    const tick = () => {
      setItems(getQueue());
      setCredits(getCredits());
    };
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const renderingCount = items.filter(r => r.status === "rendering").length;
  const queuedCount = items.filter(r => r.status === "queued").length;

  const handleClearDone = () => {
    const remaining = items.filter(i => i.status !== "done");
    items.filter(i => i.status === "done").forEach(i => removeQueueItem(i.id));
    setItems(remaining);
  };

  return (
    <div className="absolute inset-y-0 right-0 w-[400px] bg-black border-l border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-14 border-b border-border px-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">In flight</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {renderingCount} rendering · {queuedCount} queued
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-secondary transition-all focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label="Close render queue"
        >
          <X className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto scrollbar-custom">
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground font-medium">No renders in flight</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Generate from the Studio to start a render</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {items.map((render) => (
              <div
                key={render.id}
                className="bg-card border border-border p-3 space-y-2 hover:border-border transition-all group"
              >
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="size-14 bg-black overflow-hidden flex-shrink-0 relative">
                    {render.status === "rendering" && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
                        <Loader2 className="size-6 text-foreground animate-spin" strokeWidth={2.5} />
                      </div>
                    )}
                    {render.status === "queued" && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <Clock className="size-5 text-foreground" />
                      </div>
                    )}
                    {render.status === "failed" && (
                      <div className="absolute inset-0 bg-accent/80 flex items-center justify-center z-10">
                        <XCircle className="size-5 text-foreground" />
                      </div>
                    )}
                    {(render.thumb || render.resultUrl) && (
                      <img
                        src={render.resultUrl ?? render.thumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{render.athleteName || render.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{render.name}</p>
                      </div>
                      <button className="p-1 hover:bg-secondary transition-colors flex-shrink-0 focus:outline-none">
                        <MoreVertical className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {render.status === "done" && (
                        <>
                          <CheckCircle className="size-3 text-foreground" />
                          <span className="text-sm text-muted-foreground">Done · {render.startedAt}</span>
                        </>
                      )}
                      {render.status === "rendering" && (
                        <>
                          <Loader2 className="size-3 text-accent animate-spin" />
                          <span className="text-sm text-muted-foreground">Rendering {render.progress ?? 0}%</span>
                        </>
                      )}
                      {render.status === "queued" && (
                        <>
                          <Clock className="size-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Queued</span>
                        </>
                      )}
                      {render.status === "failed" && (
                        <>
                          <XCircle className="size-3 text-accent" />
                          <span className="text-sm text-muted-foreground">Failed · {render.startedAt}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {render.status === "rendering" && (
                  <div className="w-full h-px bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${render.progress ?? 0}%` }}
                    />
                  </div>
                )}

                {/* Actions */}
                {render.status === "done" && render.resultUrl && (
                  <div className="flex gap-1.5">
                    <a
                      href={render.resultUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1.5 px-2 bg-secondary hover:bg-[#1f1f1f] border border-border text-sm font-medium transition-colors flex items-center justify-center gap-1.5 text-foreground"
                    >
                      <Download className="size-3" />
                      Download
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(render.resultUrl!)}
                      className="flex-1 py-1.5 px-2 bg-secondary hover:bg-[#1f1f1f] border border-border text-sm font-medium transition-colors flex items-center justify-center gap-1.5 text-foreground"
                    >
                      <Copy className="size-3" />
                      Copy URL
                    </button>
                  </div>
                )}

                {render.status === "failed" && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { removeQueueItem(render.id); setItems(getQueue()); }}
                      className="flex-1 py-1.5 px-2 bg-accent hover:bg-[#c00] text-foreground text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="size-3" />
                      Remove
                    </button>
                  </div>
                )}

                {(render.status === "rendering" || render.status === "queued") && (
                  <button
                    onClick={() => { removeQueueItem(render.id); setItems(getQueue()); }}
                    className="w-full py-1.5 px-2 bg-secondary hover:bg-[#1f1f1f] border border-border text-sm font-medium transition-colors flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-12 border-t border-border px-5 flex items-center justify-between flex-shrink-0">
        <div className="text-sm">
          <span className="text-muted-foreground">Credits: </span>
          <span className="font-semibold text-foreground">{credits}</span>
        </div>
        <button
          onClick={handleClearDone}
          disabled={items.filter(i => i.status === "done").length === 0}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Clear completed
        </button>
      </div>
    </div>
  );
}
