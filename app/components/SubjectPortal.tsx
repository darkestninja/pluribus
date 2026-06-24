import { useState, useEffect, useRef } from "react";
import {
  Check, X, Upload, ChevronLeft, ChevronRight, ZoomIn,
  Camera, AlertCircle, Clock, CheckCircle, FileText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface SubjectOutput {
  id: string;
  url: string;
  campaignName: string;
  createdAt: string;
  subjectApprovalStatus?: "pending" | "approved" | "rejected";
  subjectRejectionNote?: string;
}

type UsageScope =
  | "social_media"
  | "paid_advertising"
  | "out_of_home"
  | "press_editorial"
  | "internal_only"
  | "unlimited";

const SCOPE_LABELS: Record<UsageScope, string> = {
  social_media:     "Social media",
  paid_advertising: "Paid advertising",
  out_of_home:      "Out-of-home / OOH",
  press_editorial:  "Press & editorial",
  internal_only:    "Internal use only",
  unlimited:        "Unlimited use",
};

interface SubjectPortalData {
  subjectId: string;
  subjectName: string;
  invitedBy: string;
  campaignName: string;
  outputs: SubjectOutput[];
  referenceCount: number;
  referenceFramesRequired: number;
  consentGiven?: boolean;
}

// 9-frame reference protocol labels
const REFERENCE_FRAMES = [
  "Front — neutral expression",
  "Front — natural smile",
  "Left profile — 90°",
  "Right profile — 90°",
  "Left three-quarter — 45°",
  "Right three-quarter — 45°",
  "Upward tilt — chin raised",
  "Downward tilt — chin lowered",
  "Action / sport context",
];

// ── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  outputs,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  outputs: SubjectOutput[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const output = outputs[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-white z-10">
        <X className="size-6" />
      </button>
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white z-10">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {index < outputs.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white z-10">
          <ChevronRight className="size-5" />
        </button>
      )}
      <div className="flex flex-col items-center gap-4 max-w-3xl px-20 max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <img src={output.url} alt="" className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl" />
        <span className="text-xs text-zinc-500">{index + 1} / {outputs.length}</span>
      </div>
    </div>
  );
}

// ── Consent step ─────────────────────────────────────────────────────────────

function ConsentStep({
  token,
  subjectName,
  invitedBy,
  campaignName,
  onComplete,
}: {
  token: string;
  subjectName: string;
  invitedBy: string;
  campaignName: string;
  onComplete: () => void;
}) {
  const [selectedScopes, setSelectedScopes] = useState<Set<UsageScope>>(new Set());
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleScope = (scope: UsageScope) => {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope); else next.add(scope);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!agreed || selectedScopes.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/subject/${token}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: Array.from(selectedScopes), note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to save consent");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="size-2 rounded-full bg-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-zinc-400">Pluribus</span>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-semibold text-white truncate max-w-[200px]">{subjectName}</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
          {/* Intro */}
          <div className="space-y-3">
            <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <FileText className="size-5 text-zinc-300" />
            </div>
            <h1 className="text-xl font-semibold">Consent to AI likeness use</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              <span className="text-white font-medium">{invitedBy}</span> has invited you to participate in the{" "}
              <span className="text-white font-medium">{campaignName}</span> campaign using AI-generated imagery of your likeness.
              Before proceeding, please review and confirm your consent below.
            </p>
          </div>

          {/* Scope selector */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-white">I consent to my likeness being used for: <span className="text-red-400">*</span></p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SCOPE_LABELS) as UsageScope[]).map(scope => {
                const active = selectedScopes.has(scope);
                return (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      active
                        ? "border-blue-500/60 bg-blue-500/10 text-white"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className={`inline-block size-3.5 rounded border mr-2 align-middle ${active ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                      {active && <Check className="size-3 text-white" />}
                    </span>
                    {SCOPE_LABELS[scope]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional note */}
          <div className="space-y-2">
            <p className="text-sm text-zinc-400">Any restrictions or conditions (optional)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Do not use for alcohol brands. Contact me before out-of-home use."
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Agreement checkbox */}
          <button
            onClick={() => setAgreed(v => !v)}
            className="flex items-start gap-3 text-left"
          >
            <span className={`size-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${agreed ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"}`}>
              {agreed && <Check className="size-3 text-white" strokeWidth={3} />}
            </span>
            <p className="text-sm text-zinc-400 leading-relaxed">
              I confirm I am the person named above and I consent to Pluribus and the campaign team using AI-generated images of my likeness for the selected purposes.
              I understand I can withdraw consent by contacting the campaign team.
            </p>
          </button>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!agreed || selectedScopes.size === 0 || submitting}
            className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Check className="size-4" /> Confirm consent and continue</>
            )}
          </button>

          <p className="text-xs text-zinc-600 text-center">
            Your consent is recorded with a timestamp and can be audited at any time.
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Reference upload section ─────────────────────────────────────────────────

function ReferenceUploadSection({
  token,
  existingCount,
  framesRequired,
}: {
  token: string;
  existingCount: number;
  framesRequired: number;
}) {
  const [uploads, setUploads] = useState<Record<number, { file: File; preview: string; status: "idle" | "uploading" | "done" | "error" }>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlot === null) return;
    const preview = URL.createObjectURL(file);
    setUploads(prev => ({ ...prev, [activeSlot]: { file, preview, status: "uploading" } }));

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("frameIndex", String(activeSlot));
      const res = await fetch(`/api/subject/${token}/references`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setUploads(prev => ({ ...prev, [activeSlot]: { ...prev[activeSlot], status: "done" } }));
    } catch {
      setUploads(prev => ({ ...prev, [activeSlot]: { ...prev[activeSlot], status: "error" } }));
    }
    e.target.value = "";
    setActiveSlot(null);
  };

  const doneCount = existingCount + Object.values(uploads).filter(u => u.status === "done").length;
  const allDone = doneCount >= framesRequired;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">Reference photos</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Upload {framesRequired} photos so the AI can accurately preserve your likeness.
          </p>
        </div>
        <span className={`text-sm font-medium shrink-0 ${allDone ? "text-emerald-400" : "text-zinc-400"}`}>
          {doneCount} / {framesRequired}
        </span>
      </div>

      {allDone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle className="size-4 shrink-0" />
          All reference photos received — thank you!
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {REFERENCE_FRAMES.map((label, i) => {
          const upload = uploads[i];
          const done = upload?.status === "done";
          const uploading = upload?.status === "uploading";
          const hasPreview = !!upload?.preview;
          return (
            <button
              key={i}
              onClick={() => { setActiveSlot(i); inputRef.current?.click(); }}
              disabled={uploading}
              className={`relative rounded-lg overflow-hidden border aspect-[3/4] flex flex-col items-center justify-center gap-2 transition-colors group
                ${done ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800"}`}
            >
              {hasPreview ? (
                <img src={upload.preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : null}
              <div className={`relative z-10 flex flex-col items-center gap-1.5 px-2 ${hasPreview ? "bg-black/50 rounded-md px-2 py-1" : ""}`}>
                {uploading ? (
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : done ? (
                  <Check className="size-4 text-emerald-400" />
                ) : (
                  <Camera className="size-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                )}
                <span className={`text-[10px] leading-tight text-center ${done ? "text-emerald-300" : "text-zinc-500 group-hover:text-zinc-300"}`}>
                  {label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <p className="text-xs text-zinc-600">
        Photos are used solely for AI likeness training on this project. They are stored securely and not shared with third parties.
      </p>
    </section>
  );
}

// ── Approval card ─────────────────────────────────────────────────────────────

function OutputApprovalCard({
  output,
  onApprove,
  onReject,
  onZoom,
}: {
  output: SubjectOutput;
  onApprove: (id: string) => void;
  onReject: (id: string, note: string) => void;
  onZoom: () => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const status = output.subjectApprovalStatus;

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(output.id);
    setBusy(false);
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) return;
    setBusy(true);
    await onReject(output.id, rejectNote.trim());
    setBusy(false);
    setShowRejectForm(false);
  };

  return (
    <div className={`rounded-xl overflow-hidden border bg-zinc-900 ${
      status === "approved" ? "border-emerald-500/40" :
      status === "rejected" ? "border-red-500/30 opacity-60" :
      "border-zinc-800"
    }`}>
      {/* Image */}
      <div className="relative aspect-[4/5] group cursor-pointer" onClick={onZoom}>
        <img src={output.url} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="size-6 text-white" />
        </div>
        {status === "approved" && (
          <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 font-medium backdrop-blur-sm">
            <Check className="size-2.5" /> Approved
          </div>
        )}
        {status === "rejected" && (
          <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/20 text-red-400 font-medium backdrop-blur-sm">
            <X className="size-2.5" /> Rejected
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        {status === "approved" && (
          <p className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle className="size-3" /> You approved this image
          </p>
        )}
        {status === "rejected" && (
          <p className="text-xs text-red-400">
            Rejected{output.subjectRejectionNote ? `: "${output.subjectRejectionNote}"` : ""}
          </p>
        )}
        {status === "pending" && !showRejectForm && (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={busy}
              className="flex-1 h-8 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check className="size-3" /> Approve
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={busy}
              className="flex-1 h-8 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <X className="size-3" /> Reject
            </button>
          </div>
        )}
        {showRejectForm && (
          <div className="space-y-2">
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Please describe the issue (e.g. face looks different, wrong expression)…"
              rows={2}
              className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-2 text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={busy || !rejectNote.trim()}
                className="flex-1 h-7 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                Submit
              </button>
              <button
                onClick={() => { setShowRejectForm(false); setRejectNote(""); }}
                className="h-7 px-2 rounded-md border border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main portal ───────────────────────────────────────────────────────────────

export function SubjectPortal({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [data, setData]     = useState<SubjectPortalData | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [outputs, setOutputs] = useState<SubjectOutput[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<"review" | "references">("review");

  useEffect(() => {
    fetch(`/api/subject/${token}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load portal");
        setData(body);
        setOutputs(body.outputs ?? []);
        setConsentGiven(body.consentGiven ?? false);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async (outputId: string) => {
    const res = await fetch(`/api/subject/${token}/outputs/${outputId}/approve`, { method: "POST" });
    if (res.ok) {
      setOutputs(prev => prev.map(o => o.id === outputId
        ? { ...o, subjectApprovalStatus: "approved", subjectRejectionNote: undefined }
        : o
      ));
    }
  };

  const handleReject = async (outputId: string, note: string) => {
    const res = await fetch(`/api/subject/${token}/outputs/${outputId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      setOutputs(prev => prev.map(o => o.id === outputId
        ? { ...o, subjectApprovalStatus: "rejected", subjectRejectionNote: note }
        : o
      ));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center">
        <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3 text-center px-4">
        <div className="size-10 rounded-full bg-zinc-800 flex items-center justify-center">
          <AlertCircle className="size-5 text-zinc-400" />
        </div>
        <p className="text-white font-medium">{error ?? "Portal not found"}</p>
        <p className="text-sm text-zinc-500">This link may have expired or been revoked.</p>
      </div>
    );
  }

  // Gate: subject must give consent before accessing the review / upload tabs
  if (!consentGiven) {
    return (
      <ConsentStep
        token={token}
        subjectName={data.subjectName}
        invitedBy={data.invitedBy}
        campaignName={data.campaignName}
        onComplete={() => setConsentGiven(true)}
      />
    );
  }

  const pendingCount   = outputs.filter(o => o.subjectApprovalStatus === "pending").length;
  const approvedCount  = outputs.filter(o => o.subjectApprovalStatus === "approved").length;
  const rejectedCount  = outputs.filter(o => o.subjectApprovalStatus === "rejected").length;
  const allReviewed    = outputs.length > 0 && pendingCount === 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-zinc-400">Pluribus</span>
          <span className="text-zinc-700">/</span>
          <span className="text-sm font-semibold text-white truncate max-w-[200px]">{data.subjectName}</span>
        </div>
        <div className="flex items-center gap-2">
          {approvedCount > 0 && (
            <button
              onClick={() => {
                // Copy a plain-text approval receipt — NOT the portal URL (which grants full write access)
                const receipt = `${data.subjectName ?? "Talent"} has approved ${approvedCount} image${approvedCount !== 1 ? "s" : ""} on Pluribus for ${data.campaignName ?? "this campaign"}.`;
                navigator.clipboard.writeText(receipt).catch(() => {});
                const btn = document.activeElement as HTMLButtonElement | null;
                if (btn) { const orig = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = orig; }, 1500); }
              }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-700/60 text-zinc-300 border border-zinc-600/40 hover:bg-zinc-700 transition-colors"
            >
              Share approved
            </button>
          )}
          {allReviewed ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
              <Check className="size-3" /> Review complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-zinc-700/60 text-zinc-400 border border-zinc-600/40">
              <Clock className="size-3" /> {pendingCount} pending
            </span>
          )}
        </div>
      </header>

      {/* 3-step onboarding progress */}
      <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-3 flex items-center gap-6">
        {[
          { step: 1, label: "Consent signed", done: true },
          { step: 2, label: `Photos uploaded (${data.captureCount}/${data.framesRequired})`, done: data.captureCount >= data.framesRequired },
          { step: 3, label: "Outputs reviewed", done: allReviewed },
        ].map(({ step, label, done }, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-zinc-700 shrink-0" />}
            <div className={`size-5 rounded-full border flex items-center justify-center shrink-0 text-[10px] font-bold
              ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-600 text-zinc-500"}`}>
              {done ? <Check className="size-3" /> : step}
            </div>
            <span className={`text-xs whitespace-nowrap ${done ? "text-zinc-300" : "text-zinc-500"}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Intro banner */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <p className="text-sm text-zinc-300 max-w-2xl">
          <span className="font-medium text-white">{data.invitedBy}</span> has invited you to review AI-generated images for the <span className="font-medium text-white">{data.campaignName}</span> campaign.
          Please approve or reject each image. Your decisions are final and will determine which assets are cleared for use.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6 flex items-center gap-1 shrink-0">
        <button
          onClick={() => setTab("review")}
          className={`px-3 py-3 text-sm border-b-2 transition-colors ${tab === "review" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          Likeness review
          <span className={`ml-1.5 text-xs ${tab === "review" ? "text-zinc-400" : "text-zinc-600"}`}>{outputs.length}</span>
        </button>
        <button
          onClick={() => setTab("references")}
          className={`px-3 py-3 text-sm border-b-2 transition-colors ${tab === "references" ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          Reference photos
          {data.referenceCount < data.referenceFramesRequired && (
            <span className="ml-1.5 text-xs text-amber-400">{data.referenceCount}/{data.referenceFramesRequired}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "review" && (
          <>
            {outputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <p className="text-sm">No images to review yet</p>
              </div>
            ) : (
              <>
                {/* Summary strip */}
                <div className="flex items-center gap-4 mb-6 text-xs text-zinc-500">
                  <span>{outputs.length} total</span>
                  {approvedCount > 0 && <span className="text-emerald-400">{approvedCount} approved</span>}
                  {rejectedCount > 0 && <span className="text-red-400">{rejectedCount} rejected</span>}
                  {pendingCount > 0 && <span className="text-zinc-400">{pendingCount} pending</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {outputs.map((output, idx) => (
                    <OutputApprovalCard
                      key={output.id}
                      output={output}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onZoom={() => setLightboxIdx(idx)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "references" && (
          <div className="max-w-lg">
            <ReferenceUploadSection
              token={token}
              existingCount={data.referenceCount}
              framesRequired={data.referenceFramesRequired}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-xs text-zinc-600">Your likeness portal — private link</span>
        <span className="text-xs text-zinc-600">Powered by Pluribus</span>
      </footer>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          outputs={outputs}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIdx(i => Math.min(outputs.length - 1, (i ?? 0) + 1))}
        />
      )}
    </div>
  );
}
