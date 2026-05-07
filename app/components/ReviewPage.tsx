import { useState, useEffect } from "react";
import { Download, Check, Clock, PenLine, Flag, X, ZoomIn, ChevronLeft, ChevronRight } from "lucide-react";
import type { CampaignOutput, OutputStatus } from "../lib/store";

interface ReviewData {
  campaignName: string;
  campaignId: string;
  outputs: CampaignOutput[];
}

function statusLabel(status: OutputStatus): { label: string; classes: string } {
  switch (status) {
    case "approved":       return { label: "Approved",      classes: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    case "needs_revision": return { label: "Needs revision", classes: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    case "flagged":        return { label: "Flagged",        classes: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    case "rejected":       return { label: "Rejected",       classes: "bg-red-500/20 text-red-400 border-red-500/30" };
    default:               return { label: "Pending",        classes: "bg-zinc-700/60 text-zinc-400 border-zinc-600/40" };
  }
}

function statusIcon(status: OutputStatus) {
  switch (status) {
    case "approved":       return <Check className="size-3" />;
    case "needs_revision": return <PenLine className="size-3" />;
    case "flagged":        return <Flag className="size-3" />;
    case "rejected":       return <X className="size-3" />;
    default:               return <Clock className="size-3" />;
  }
}

function cardRing(status: OutputStatus): string {
  switch (status) {
    case "approved":       return "ring-2 ring-emerald-500/60";
    case "needs_revision": return "ring-2 ring-blue-500/60";
    case "flagged":        return "ring-2 ring-amber-500/60";
    case "rejected":       return "opacity-40";
    default:               return "";
  }
}

interface LightboxProps {
  outputs: CampaignOutput[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ outputs, index, onClose, onPrev, onNext }: LightboxProps) {
  const output = outputs[index];
  const { label, classes } = statusLabel(output.status);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   onPrev();
      if (e.key === "ArrowRight")  onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors z-10">
        <X className="size-6" />
      </button>

      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white transition-colors z-10">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < outputs.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white transition-colors z-10">
          <ChevronRight className="size-5" />
        </button>
      )}

      <div className="flex flex-col items-center gap-4 max-w-4xl max-h-[90vh] px-16" onClick={e => e.stopPropagation()}>
        <img src={output.url} alt="" className="max-h-[75vh] max-w-full rounded-lg object-contain shadow-2xl" />
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${classes}`}>
            {statusIcon(output.status)} {label}
          </span>
          {output.status === "approved" && (
            <a href={output.url} download target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-400 transition-colors">
              <Download className="size-3" /> Download
            </a>
          )}
          <span className="text-xs text-zinc-600">{index + 1} / {outputs.length}</span>
        </div>
      </div>
    </div>
  );
}

export function ReviewPage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReviewData | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [filter, setFilter] = useState<OutputStatus | "all">("all");

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load review");
        setData(body);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
        <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 text-center px-4">
        <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center">
          <X className="size-5 text-zinc-400" />
        </div>
        <p className="text-white font-medium">{error ?? "Review not found"}</p>
        <p className="text-sm text-zinc-500">This link may have expired or been revoked.</p>
      </div>
    );
  }

  const allOutputs = data.outputs;
  const counts: Record<string, number> = { all: allOutputs.length };
  for (const o of allOutputs) counts[o.status] = (counts[o.status] ?? 0) + 1;

  const visible = filter === "all" ? allOutputs : allOutputs.filter(o => o.status === filter);
  const approvedCount = counts["approved"] ?? 0;

  const tabs: Array<{ key: OutputStatus | "all"; label: string }> = [
    { key: "all",            label: "All" },
    { key: "approved",       label: "Approved" },
    { key: "pending",        label: "Pending" },
    { key: "needs_revision", label: "Revision" },
    { key: "flagged",        label: "Flagged" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-400">Pluribus</span>
          <span className="text-zinc-700">/</span>
          <span className="text-sm font-semibold text-white truncate max-w-xs">{data.campaignName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{allOutputs.length} assets · {approvedCount} approved</span>
          {approvedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
              <Check className="size-3" /> {approvedCount} ready
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6 flex items-center gap-1 shrink-0">
        {tabs.map(tab => {
          const count = counts[tab.key] ?? 0;
          if (tab.key !== "all" && count === 0) return null;
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-3 text-sm border-b-2 transition-colors ${
                active
                  ? "border-white text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${active ? "text-zinc-400" : "text-zinc-600"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Gallery */}
      <main className="flex-1 overflow-y-auto p-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
            <p className="text-sm">No assets in this view</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {visible.map((output, idx) => {
              const { label, classes } = statusLabel(output.status);
              const globalIdx = allOutputs.indexOf(output);
              return (
                <div
                  key={output.id}
                  className={`group relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 cursor-pointer ${cardRing(output.status)}`}
                  onClick={() => setLightboxIdx(globalIdx)}
                >
                  <div className="aspect-square">
                    <img src={output.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="size-6 text-white" />
                  </div>

                  {/* Status chip */}
                  <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium backdrop-blur-sm ${classes}`}>
                      {statusIcon(output.status)} {label}
                    </span>
                  </div>

                  {/* Download on approved */}
                  {output.status === "approved" && (
                    <a
                      href={output.url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="absolute bottom-2 right-2 size-7 rounded-md bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Download className="size-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-xs text-zinc-600">Review link — view only</span>
        <span className="text-xs text-zinc-600">Powered by Pluribus</span>
      </footer>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          outputs={allOutputs}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx(i => Math.min(allOutputs.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  );
}
