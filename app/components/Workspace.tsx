import { useState, useCallback, useEffect } from "react";
import {
  Sparkles, Video, Image as ImageIcon, Download, X, ChevronDown, Search,
  Check, AlertCircle, Plus, RefreshCw, Upload,
} from "lucide-react";
import { generateVideo, submitGeneration } from "../lib/generate";
import { calculateIdentityReadiness } from "../lib/identityReadiness";
import { ReadinessBadge } from "./ReadinessBadge";
import {
  getAthletes, getProjects, getAthleteProfile,
  getCanonicalReferences, getCanonicalReferencesSync,
  getWardrobeKits, getMoodboards,
  addCampaignOutput, getCampaignOutputs, updateCampaignOutput,
  addRun, updateRun, getCredits, deductCredits, refreshCredits,
  addJob, getJobById, getActiveJobForCampaign, saveAthleteProfile,
  addWardrobeKit, addMoodboard, getIdentityMatchTier,
  type CampaignOutput, type WardrobeKit, type Moodboard, type GenerationJob,
} from "../lib/store";
import { buildWardrobePrompt, getWardrobeRefImages } from "../lib/wardrobePrompt";
import { CAMPAIGN_PACKS, packTotalImages, packTotalCredits, PACK_CREDITS_PER_IMAGE, type CampaignPack } from "../../data/campaignPacks";
import { buildMoodboardPrompt } from "../lib/moodboardPrompt";
import { PALETTE } from "../../data/wardrobe";
import { computeResemblanceScore } from "../lib/faceScore";
import { buildGenerationPrompt } from "../lib/promptEnhancer";
import { mirrorAsset } from "../lib/storage";
import { toast } from "../lib/notifications";

import type { AthleteProfile } from "../../data/athletes";

// ── Tiers ──────────────────────────────────────────────────────────────────

const IMAGE_TIERS = [
  { id: "nano-banana", label: "Generate", cost: "$0.04", credits: 4, desc: "Identity generation" },
] as const;

const VIDEO_TIERS = [
  { id: "pika",  label: "Fast",      cost: "$0.25", credits: 25  },
  { id: "kling", label: "Standard",  cost: "$0.35", credits: 35  },
  { id: "sora",  label: "Cinematic", cost: "$1.50", credits: 150 },
] as const;
type VideoTierId = typeof VIDEO_TIERS[number]["id"];

const RATIO_OPTIONS = [
  { value: "9:16",  label: "9:16 — Story"      },
  { value: "4:5",   label: "4:5 — Portrait"    },
  { value: "1:1",   label: "1:1 — Square"      },
  { value: "16:9",  label: "16:9 — Landscape"  },
  { value: "3:4",   label: "3:4 — Portrait"    },
  { value: "4:3",   label: "4:3 — Classic"     },
];

const VIDEO_DURATIONS = ["5s", "10s"] as const;

// ── Component ──────────────────────────────────────────────────────────────

interface WorkspaceProps {
  workspaceId: string;
  prefill?: { athleteId?: string };
  onBack: () => void;
}

type GenMode    = "image" | "video";
type GenState   = "idle" | "generating" | "done";
type ScoreState = "idle" | "computing" | "done";

interface SessionEntry {
  id: string;
  urls: string[];
  scores: (number | null)[];
  ratio: string;
  athleteName?: string;
  timestamp: string;
}

export function Workspace({ workspaceId, prefill, onBack }: WorkspaceProps) {
  const athletes     = getAthletes();
  const wardrobeKits = getWardrobeKits();
  const moodboards   = getMoodboards();
  const projects     = getProjects().filter(p => p.type === "active");

  // When opened from a campaign, workspaceId is the campaign ID
  const campaignContext = projects.find(p => p.id === workspaceId);

  const initAthlete = prefill?.athleteId ?? athletes[0]?.id ?? "";

  // ── Core selection ────────────────────────────────────────────────────────
  const [selectedAthleteId, setSelectedAthleteId] = useState(initAthlete);
  const [mode, setMode] = useState<GenMode>("image");

  // ── Generation params ─────────────────────────────────────────────────────
  const [selectedRatio,  setSelectedRatio]  = useState("9:16");
  const [videoTierId,    setVideoTierId]    = useState<VideoTierId>("kling");
  const [videoDuration,  setVideoDuration]  = useState<typeof VIDEO_DURATIONS[number]>("5s");
  const [customNotes,    setCustomNotes]    = useState("");
  const [randomSeed,     setRandomSeed]     = useState(true);
  const [seedValue,      setSeedValue]      = useState(42);
  const [showAdvanced,   setShowAdvanced]   = useState(false);

  // ── Gen state ─────────────────────────────────────────────────────────────
  const [genState,       setGenState]       = useState<GenState>("idle");
  const [genProgress,    setGenProgress]    = useState(0);
  const [generatedUrls,  setGeneratedUrls]  = useState<string[]>([]);
  const [selectedIdx,    setSelectedIdx]    = useState(0);
  const [genError,       setGenError]       = useState<string | null>(null);
  const [capturedSeed,   setCapturedSeed]   = useState<number | undefined>();
  const [lastRunId,      setLastRunId]      = useState<string | null>(null);
  const [credits,        setCredits]        = useState(getCredits);

  // ── Background job tracking ────────────────────────────────────────────────
  // Tracks the active GenerationJob ID — survives navigation and page refresh.
  const [activeJobId, setActiveJobId]       = useState<string | null>(null);

  // ── Resemblance ───────────────────────────────────────────────────────────
  const [scores,       setScores]      = useState<(number | null)[]>([]);
  const [scoreState,   setScoreState]  = useState<ScoreState>("idle");

  // ── Run tracking ──────────────────────────────────────────────────────────
  const [lastRunCampaignId, setLastRunCampaignId] = useState("studio");

  // ── Post-gen campaign assignment ──────────────────────────────────────────
  const [targetCampaignId, setTargetCampaignId] = useState(campaignContext?.id ?? projects[0]?.id ?? "");
  const [added,            setAdded]            = useState(false);

  // ── Prompt mode ───────────────────────────────────────────────────────────
  const [promptMode, setPromptMode] = useState<"oneoff" | "pack">("oneoff");

  // ── Wardrobe ──────────────────────────────────────────────────────────────
  const [selectedWardrobeId,   setSelectedWardrobeId]   = useState("");
  const [showWardrobePicker,   setShowWardrobePicker]   = useState(false);

  // ── Moodboard ─────────────────────────────────────────────────────────────
  const [selectedMoodboardId,  setSelectedMoodboardId]  = useState("");
  const [showMoodboardPicker,  setShowMoodboardPicker]  = useState(false);

  // ── Session history ───────────────────────────────────────────────────────
  const [sessionHistory,   setSessionHistory]   = useState<SessionEntry[]>([]);
  const [activeEntryId,    setActiveEntryId]    = useState<string | null>(null);

  // ── Settings-change tracking (for Generate vs Regenerate button) ──────────
  const [genSettings,      setGenSettings]      = useState<string>("");

  // ── Inline wardrobe creation ──────────────────────────────────────────────
  const [wardrobePickerTab,    setWardrobePickerTab]    = useState<"browse" | "create">("browse");
  const [wardrobeCreateName,   setWardrobeCreateName]   = useState("");
  const [wardrobeCreateUrls,   setWardrobeCreateUrls]   = useState<string[]>([]);

  // ── Inline moodboard creation ─────────────────────────────────────────────
  const [moodboardPickerTab,   setMoodboardPickerTab]   = useState<"browse" | "create">("browse");
  const [moodboardCreateName,  setMoodboardCreateName]  = useState("");
  const [moodboardCreateUrls,  setMoodboardCreateUrls]  = useState<string[]>([]);

  // ── Campaign pack ────────────────────────────────────────────────────────
  const [selectedPackId,   setSelectedPackId]   = useState("");
  const [packSubmitting,   setPackSubmitting]   = useState(false);
  const [packProgress,     setPackProgress]     = useState<{ current: number; total: number } | null>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [subjectSearch,     setSubjectSearch]     = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────
  const athlete     = athletes.find(a => a.id === selectedAthleteId);
  const wardrobeKit = wardrobeKits.find(k => k.id === selectedWardrobeId);
  const moodboard   = moodboards.find(m => m.id === selectedMoodboardId);
  const imageTier   = IMAGE_TIERS[0];
  const videoTier   = VIDEO_TIERS.find(t => t.id === videoTierId) ?? VIDEO_TIERS[1];
  const creditsPerGen = mode === "image" ? imageTier.credits : videoTier.credits;
  const generatedUrl  = generatedUrls[selectedIdx] ?? null;

  const selectedPack    = CAMPAIGN_PACKS.find(p => p.id === selectedPackId) ?? null;
  const packImages      = selectedPack ? packTotalImages(selectedPack) : 0;
  const packCredits     = selectedPack ? packTotalCredits(selectedPack) : 0;
  const canGeneratePack = !!athlete && !!selectedPack && !packSubmitting && mode === "image";

  // Track settings fingerprint so button can switch from "Regenerate" → "Generate"
  const currentSettings = [
    selectedAthleteId, selectedWardrobeId, selectedMoodboardId, selectedRatio, customNotes, promptMode, mode,
  ].join("|");
  const settingsChanged = genState === "done" && genSettings !== "" && currentSettings !== genSettings;

  // Pre-warm fal CDN URLs for the selected athlete so generation can start without upload wait.
  // Runs in background whenever the athlete changes — silently ignored on failure.
  useEffect(() => {
    if (!selectedAthleteId) return;
    const profile = getAthleteProfile(selectedAthleteId);
    if (!profile) return;
    const uncached = profile.captureAngles.filter(
      (a): a is typeof a & { dataUrl: string } => !a.falCdnUrl && typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:")
    );
    if (uncached.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const angle of uncached) {
        if (cancelled) break;
        try {
          const { uploadToFalCdn } = await import("../lib/generate");
          const falCdnUrl = await uploadToFalCdn(angle.dataUrl);
          if (cancelled) break;
          const latest = getAthleteProfile(selectedAthleteId);
          if (latest) {
            saveAthleteProfile({
              ...latest,
              captureAngles: latest.captureAngles.map(a => a.key === angle.key ? { ...a, falCdnUrl } : a),
              version: latest.version + 1,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch { /* continue with next angle */ }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedAthleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: recover an active job for this workspace (survives navigation + refresh)
  useEffect(() => {
    const cid = workspaceId !== "new" ? workspaceId : "studio";
    const existing = getActiveJobForCampaign(cid);
    if (existing) {
      setActiveJobId(existing.id);
      setGenState("generating");
      setGenProgress(existing.progress);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync local display state from the store job — the global App poller drives updates
  useEffect(() => {
    if (!activeJobId) return;
    const id = setInterval(() => {
      const job = getJobById(activeJobId);
      if (!job) return;
      setGenProgress(job.progress);
      if (job.status === "complete") {
        const urls = job.resultUrls;
        const entryId = `entry-${job.id}`;
        setGeneratedUrls(urls);
        setSelectedIdx(0);
        setGenState("done");
        setActiveEntryId(entryId);
        setSessionHistory(h => {
          // Avoid duplicates if interval fires multiple times
          if (h.some(e => e.id === entryId)) return h;
          return [...h, {
            id: entryId,
            urls,
            scores: [],
            ratio: job.aspectRatio,
            athleteName: job.subjectName,
            timestamp: job.completedAt ?? new Date().toISOString(),
          }];
        });
        if (job.seed !== undefined) setCapturedSeed(job.seed);
        refreshCredits().then(() => setCredits(getCredits()));
        setActiveJobId(null);
        // Score identity match after results land
        if (job.subjectId) {
          const scoreRef = getCanonicalReferencesSync(getAthleteProfile(job.subjectId))[0];
          if (scoreRef) scoreUrls(urls, scoreRef);
        }
      } else if (job.status === "failed") {
        setGenError(job.error ?? "Generation failed");
        setGenState("idle");
        setActiveJobId(null);
      }
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId]);

  // Keyboard: Esc closes modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSubjectPicker(false);
        setShowWardrobePicker(false);
        setShowMoodboardPicker(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Build prompt ──────────────────────────────────────────────────────────
  const buildPrompt = useCallback(() => {
    const doNotChange = athlete ? (getAthleteProfile(athlete.id)?.doNotChange ?? []) : [];
    return buildGenerationPrompt({
      customNotes:   customNotes || undefined,
      doNotChange:   doNotChange.length ? doNotChange : undefined,
      wardrobeText:  wardrobeKit ? buildWardrobePrompt(wardrobeKit) : undefined,
      moodboardText: moodboard   ? buildMoodboardPrompt(moodboard)  : undefined,
    });
  }, [athlete, customNotes, wardrobeKit, moodboard]);

  // ── Campaign pack generation ──────────────────────────────────────────────
  const handlePackGenerate = async () => {
    if (!athlete || !selectedPack) return;
    if (credits < packCredits) {
      toast({ type: "error", title: "Insufficient credits", body: `This pack requires ${packCredits} credits — you have ${credits}.` });
      return;
    }

    setPackSubmitting(true);
    const profile = getAthleteProfile(athlete.id);
    const refDataUrls = await getCanonicalReferences(profile);
    const wardrobeImageUrls = wardrobeKit ? getWardrobeRefImages(wardrobeKit) : [];
    const wardrobeText  = wardrobeKit ? buildWardrobePrompt(wardrobeKit) : "";
    const moodboardText = moodboard ? buildMoodboardPrompt(moodboard) : "";
    const constraints   = profile?.doNotChange ?? [];

    const totalJobs = packImages;
    let completed = 0;
    setPackProgress({ current: 0, total: totalJobs });

    const cid = targetCampaignId || "studio";

    for (const slot of selectedPack.slots) {
      for (let i = 0; i < slot.count; i++) {
        const runId = `run-${crypto.randomUUID().slice(0, 8)}`;
        const jobId = `job-${crypto.randomUUID().slice(0, 8)}`;

        let prompt = `${slot.promptNotes}`;
        if (constraints.length > 0) prompt += `, ${constraints.join(", ")}`;
        if (wardrobeText) prompt += `\n\n${wardrobeText}`;
        if (moodboardText) prompt += `\n\n${moodboardText}`;

        const recipeName = `${selectedPack.name} · ${slot.label}`;

        addRun({
          id: runId, campaignId: cid,
          athleteId: athlete.id, athleteName: athlete.name,
          recipeName,
          prompt, model: "Identity generation", aspectRatio: slot.aspectRatio,
          status: "running", startedAt: new Date().toISOString(), assetIds: [],
        });

        const remaining = deductCredits(PACK_CREDITS_PER_IMAGE);
        setCredits(remaining);

        try {
          const { requestId, modelId } = await submitGeneration({
            prompt,
            aspectRatio: slot.aspectRatio,
            numImages: 1,
            referenceImageDataUrls: refDataUrls.length > 0 ? refDataUrls : undefined,
            wardrobeImageUrls: wardrobeImageUrls.length > 0 ? wardrobeImageUrls : undefined,
          });

          addJob({
            id: jobId, subjectId: athlete.id, subjectName: athlete.name,
            recipeName, prompt, aspectRatio: slot.aspectRatio,
            modelId, requestId, status: "queued", progress: 5, resultUrls: [],
            startedAt: new Date().toISOString(),
            runId, campaignId: cid, mode: "image",
            packId: selectedPack.id, packName: selectedPack.name,
          });

          updateRun(cid, runId, { status: "running" });
        } catch {
          updateRun(cid, runId, { status: "failed", errorMessage: "Submission failed", completedAt: new Date().toISOString() });
        }

        completed++;
        setPackProgress({ current: completed, total: totalJobs });
      }
    }

    setPackSubmitting(false);
    setPackProgress(null);
    refreshCredits().then(() => setCredits(getCredits()));
    toast({
      type: "success",
      title: `${selectedPack.name} queued`,
      body: `${totalJobs} image${totalJobs > 1 ? "s" : ""} generating in the background — check Queue for progress.`,
    });
  };

  // ── Score resemblance ─────────────────────────────────────────────────────
  const scoreUrls = async (urls: string[], refUrl: string | undefined) => {
    if (!refUrl || urls.length === 0 || mode !== "image") return;
    setScoreState("computing");
    const result = await Promise.all(urls.map(u => computeResemblanceScore(refUrl, u)));
    setScores(result);
    setScoreState("done");
  };

  // ── Run generation ────────────────────────────────────────────────────────
  const runGeneration = async () => {
    if (!athlete) { toast({ type: "error", title: "No talent selected", body: "Select a talent before generating." }); return; }

    setGenState("generating");
    setGenProgress(5);
    setGenError(null);
    setGeneratedUrls([]);
    setScores([]);
    setScoreState("idle");
    setAdded(false);
    setCapturedSeed(undefined);
    setGenSettings(currentSettings);

    // Extract wardrobe image refs (upload-mode kits only — builder kits use text prompt)
    const wardrobeImageUrls = wardrobeKit ? getWardrobeRefImages(wardrobeKit) : [];

    const prompt      = buildPrompt();
    const runId       = `run-${crypto.randomUUID().slice(0, 8)}`;
    const jobId       = `job-${crypto.randomUUID().slice(0, 8)}`;
    const cid         = targetCampaignId || "studio";
    const modelLabel = mode === "image" ? imageTier.label : videoTier.label;

    setLastRunCampaignId(cid);
    addRun({
      id: runId,
      campaignId: cid,
      athleteId: athlete.id, athleteName: athlete.name,
      prompt,
      model: modelLabel,
      aspectRatio: selectedRatio,
      status: "running",
      startedAt: new Date().toISOString(),
      assetIds: [],
    });
    setLastRunId(runId);

    // Deduct credits immediately so the UI reflects the cost
    const remaining = deductCredits(creditsPerGen);
    setCredits(remaining);

    try {
      if (mode === "image") {
        const profile = athlete ? getAthleteProfile(athlete.id) : null;
        const refDataUrls = await getCanonicalReferences(profile);

        // Submit to fal queue — non-blocking, returns immediately
        const { requestId, modelId } = await submitGeneration({
          prompt,
          aspectRatio: selectedRatio,
          numImages: 1,
          referenceImageDataUrls: refDataUrls.length > 0 ? refDataUrls : undefined,
          wardrobeImageUrls: wardrobeImageUrls.length > 0 ? wardrobeImageUrls : undefined,
        });

        // Persist job so any page (and the global poller) can track it
        addJob({
          id:          jobId,
          subjectId:   athlete.id,
          subjectName: athlete.name,
          prompt,
          aspectRatio: selectedRatio,
          modelId,
          requestId,
          status:      "queued",
          progress:    5,
          resultUrls:  [],
          startedAt:   new Date().toISOString(),
          runId,
          campaignId:  cid,
          mode:        "image",
        });

        setActiveJobId(jobId);
        toast({ type: "info", title: "Generating in background", body: "You can navigate away — we'll notify you when it's ready." });

      } else {
        // Video: use blocking fal.subscribe (video gen is slower, no queue API parity needed yet)
        const video = await generateVideo({
          prompt,
          model: videoTierId,
          duration: parseInt(videoDuration),
          aspectRatio: selectedRatio,
          onProgress: pct => setGenProgress(pct),
        });
        const urls = video?.url ? [video.url] : [];
        setGeneratedUrls(urls);
        setSelectedIdx(0);
        setGenState("done");
        updateRun(cid, runId, { status: "complete", completedAt: new Date().toISOString(), assetIds: [] });
        toast({ type: "success", title: "Generated", body: "Video ready." });
      }

      refreshCredits().then(() => setCredits(getCredits()));

    } catch (err: any) {
      const isOutOfCredits = err?.status === 402 || String(err?.message ?? "").includes("402") || String(err?.message ?? "").toLowerCase().includes("payment");
      const msg = isOutOfCredits ? "Out of credits — contact your admin to top up." : (err?.message ?? "Generation failed");
      setGenError(msg);
      setGenState("idle");
      updateRun(cid, runId, { status: "failed", errorMessage: msg });
      toast({ type: "error", title: isOutOfCredits ? "Out of credits" : "Generation failed", body: msg });
    }
  };

  // ── Add to campaign ───────────────────────────────────────────────────────
  const handleAddToCampaign = () => {
    if (!targetCampaignId || generatedUrls.length === 0) return;

    const existing = getCampaignOutputs();
    const assetIds: string[] = [];

    generatedUrls.forEach((url, i) => {
      // The global poller auto-persists completed jobs. If it already saved this URL,
      // move/update it rather than creating a duplicate entry.
      const dup = existing.find(o => o.originalFalUrl === url || o.url === url);
      if (dup) {
        const patch: Partial<CampaignOutput> = {};
        if (dup.campaignId !== targetCampaignId) patch.campaignId = targetCampaignId;
        if (!dup.runId && lastRunId) patch.runId = lastRunId;
        if (scores[i] != null && !dup.resemblanceScore) patch.resemblanceScore = scores[i];
        if (Object.keys(patch).length > 0) updateCampaignOutput(dup.id, patch);
        assetIds.push(dup.id);
        return;
      }

      const outputId = `out-${crypto.randomUUID().slice(0, 8)}`;
      assetIds.push(outputId);

      addCampaignOutput({
        id: outputId,
        campaignId: targetCampaignId,
        athleteId: athlete?.id,
        runId: lastRunId ?? undefined,
        url,
        originalFalUrl: url,
        status: "pending",
        createdAt: new Date().toISOString(),
        resemblanceScore: scores[i] ?? undefined,
      });

      // Non-blocking mirror to Supabase Storage
      const ext  = mode === "video" ? "mp4" : "jpg";
      const path = `${athlete?.id ?? "unknown"}/${outputId}.${ext}`;
      mirrorAsset(url, path).then(mirrored => {
        if (mirrored?.signedUrl) {
          updateCampaignOutput(outputId, { url: mirrored.signedUrl, storagePath: mirrored.path });
        }
      });
    });

    if (lastRunId) {
      updateRun(lastRunCampaignId, lastRunId, { assetIds });
    }

    setAdded(true);
    const campaign = projects.find(p => p.id === targetCampaignId);
    toast({ type: "success", title: "Added to campaign", body: campaign?.name ?? "Campaign" });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scoreColor = (s: number) => {
    const t = getIdentityMatchTier(s);
    return `${t.bgClass} ${t.textClass} ${t.borderClass}`;
  };

  const hasResults   = generatedUrls.length > 0;
  const canGenerate  = !!athlete && genState !== "generating";
  // Allow generation when done + settings changed (button shows "Generate" instead of "Regenerate")
  const canGenerateNow = canGenerate && (genState === "idle" || genState === "done");

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex bg-background overflow-hidden">

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Toolbar */}
        <div className="h-11 border-b border-border bg-background px-4 flex items-center gap-2 shrink-0">
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            ← {campaignContext ? `Back to ${campaignContext.name}` : "Back"}
          </button>
          <span className="text-border/60 mx-1">·</span>
          {athlete
            ? <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <img src={athlete.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : athlete.image} alt="" className="size-4 rounded-full object-cover" />
                <span className="text-foreground">{athlete.name}</span>
              </span>
            : <span className="text-sm text-muted-foreground">No talent</span>
          }
          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <span className="font-medium text-foreground">{creditsPerGen}cr</span>
            <span className="text-muted-foreground/60">≈ {mode === "image" ? imageTier.cost : videoTier.cost}</span>
            <span className="mx-1">·</span>
            {credits}cr left
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-background p-6 sm:p-10">
          {genState === "generating" ? (
            /* Progress state */
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="size-12 rounded-full border-2 border-border flex items-center justify-center">
                <span className="size-2 rounded-full bg-accent pulse-dot" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-foreground font-medium">
                  {mode === "video" ? "Generating video" : "Generating image"}
                </p>
                <p className="text-xs text-muted-foreground">{Math.round(Math.min(genProgress, 100))}%</p>
              </div>
              <div className="w-48 h-px bg-border overflow-hidden rounded-full">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.min(genProgress, 100)}%` }} />
              </div>
              {athlete && (
                <p className="text-xs text-muted-foreground">{athlete.name}</p>
              )}
            </div>
          ) : genError ? (
            /* Error state */
            <div className="flex flex-col items-center gap-3 p-6 bg-card border border-destructive/30 rounded-xl max-w-sm text-center">
              <AlertCircle className="size-5 text-destructive" strokeWidth={1.75} />
              <p className="text-sm text-destructive">{genError}</p>
              <button
                onClick={() => { setGenState("idle"); setGenError(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
          ) : hasResults ? (
            /* Result */
            <div className="relative group">
              {mode === "video" && generatedUrl ? (
                <video
                  src={generatedUrl}
                  autoPlay loop muted playsInline
                  className="max-h-[calc(100vh-260px)] max-w-full rounded-lg"
                />
              ) : (
                <img
                  src={generatedUrl!}
                  alt="Generated asset"
                  className="max-h-[calc(100vh-260px)] max-w-full rounded-lg"
                />
              )}
              {/* Resemblance badge */}
              {scoreState === "computing" && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs bg-background/80 backdrop-blur-sm border border-border text-muted-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-accent pulse-dot" /> Scoring…
                </div>
              )}
              {scoreState === "done" && scores[selectedIdx] != null && (() => {
                const s = scores[selectedIdx]!;
                const tier = getIdentityMatchTier(s);
                return (
                  <div
                    className={`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-semibold border backdrop-blur-sm ${scoreColor(s)}`}
                    title={`${tier.recommendedUse}${tier.restrictionReason ? ` — ${tier.restrictionReason}` : ""}`}
                  >
                    {s}% · {tier.label}
                  </div>
                );
              })()}
              {/* Hover actions */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <a
                  href={generatedUrl!}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-3 rounded-md bg-background/90 backdrop-blur-sm border border-border text-xs font-medium flex items-center gap-1.5 hover:bg-card transition-colors"
                >
                  <Download className="size-3.5" strokeWidth={1.75} /> Download
                </a>
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center gap-5 text-center max-w-xs">
              <div className="size-20 rounded-xl bg-card border border-border flex items-center justify-center">
                <Sparkles className="size-8 text-accent/50" strokeWidth={1.5} />
              </div>
              <p className="text-xs text-muted-foreground">
                {!athlete ? "Select a talent to get started" : "Ready to generate"}
              </p>
            </div>
          )}
        </div>

        {/* Session history strip — persists across all generations in this session */}
        {sessionHistory.length > 0 && (
          <div className="border-t border-border bg-background shrink-0">
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-3 py-2">
              {sessionHistory.map((entry, entryIdx) => (
                <div key={entry.id} className="flex items-center gap-1 shrink-0">
                  {entryIdx > 0 && <div className="w-px h-8 bg-border mx-2 shrink-0" />}
                  <div className="flex gap-1 shrink-0 items-center">
                    <span className="text-[9px] text-muted-foreground/40 mr-0.5 select-none">{entryIdx + 1}</span>
                    {entry.urls.map((url, imgIdx) => {
                      const isActive = activeEntryId === entry.id && generatedUrls[selectedIdx] === url;
                      return (
                        <button
                          key={imgIdx}
                          onClick={() => {
                            setGeneratedUrls(entry.urls);
                            setSelectedIdx(imgIdx);
                            setActiveEntryId(entry.id);
                            // Restore scores if stored in history entry (updated below)
                            setScores(entry.scores ?? []);
                            setScoreState(entry.scores?.length > 0 ? "done" : "idle");
                            setGenState("done");
                          }}
                          className={`relative h-14 aspect-[3/4] rounded-md overflow-hidden border-2 transition-all ${
                            isActive ? "border-accent" : "border-transparent opacity-40 hover:opacity-75"
                          }`}
                        >
                          <img src={url} alt={`Gen ${entryIdx + 1}`} className="w-full h-full object-cover" />
                          {entry.scores?.[imgIdx] != null && (() => {
                            const tier = getIdentityMatchTier(entry.scores[imgIdx]!);
                            return (
                              <div className={`absolute bottom-0 inset-x-0 text-center text-[8px] font-bold py-0.5 ${tier.overlayClass}`}>
                                {entry.scores[imgIdx]}%
                              </div>
                            );
                          })()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right rail ──────────────────────────────────────────────────────── */}
      <aside className="w-[288px] border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4">

            {/* Image / Video mode */}
            <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-card border border-border rounded-lg">
              {(["image", "video"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`h-8 rounded-md text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "image"
                    ? <ImageIcon className="size-3.5" strokeWidth={1.75} />
                    : <Video className="size-3.5" strokeWidth={1.75} />}
                  {m === "image" ? "Image" : "Video"}
                </button>
              ))}
            </div>

            {/* Subject */}
            <RailSection label="Talent">
              {athlete ? (
                <div className="flex items-center gap-2.5 p-2.5 bg-card border border-border rounded-lg">
                  <img
                    src={athlete.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : athlete.image}
                    alt={athlete.name}
                    className="size-10 rounded-md object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{athlete.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{athlete.sport}</p>
                  </div>
                  <button
                    onClick={() => setShowSubjectPicker(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-1 rounded hover:bg-secondary"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubjectPicker(true)}
                  className="w-full h-10 rounded-lg border-2 border-dashed border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="size-3.5" strokeWidth={1.75} /> Select talent
                </button>
              )}
            </RailSection>

            {/* One-off / Pack mode */}
            <RailSection label="Prompt">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-card border border-border rounded-lg mb-3">
                <button
                  onClick={() => setPromptMode("oneoff")}
                  className={`h-7 rounded text-xs font-medium transition-colors ${promptMode === "oneoff" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  One-off
                </button>
                <button
                  onClick={() => { setPromptMode("pack"); if (mode !== "image") setMode("image"); }}
                  title={mode === "video" ? "Packs are image-only" : undefined}
                  className={`h-7 rounded text-xs font-medium transition-colors ${promptMode === "pack" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Pack
                </button>
              </div>

              {promptMode === "pack" ? (
                /* ── Pack picker ─────────────────────────────────── */
                <div className="space-y-2">
                  {CAMPAIGN_PACKS.map(pack => (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedPackId === pack.id
                          ? "border-accent bg-accent/8"
                          : "border-border bg-card hover:border-accent/40 hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-foreground">{pack.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {packTotalImages(pack)} images · {packTotalCredits(pack)}cr
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{pack.description}</p>
                    </button>
                  ))}

                  {/* Slot breakdown */}
                  {selectedPack && (
                    <div className="rounded-lg border border-border bg-card overflow-hidden mt-1">
                      <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Slots</span>
                        <span className="text-[10px] text-muted-foreground">{packCredits}cr total</span>
                      </div>
                      {selectedPack.slots.map((slot, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 last:border-0">
                          <div className="min-w-0">
                            <span className="text-xs text-foreground">{slot.label}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{slot.aspectRatio}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">×{slot.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* One-off: aspect ratio + custom notes */
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Aspect ratio</p>
                    <select
                      value={selectedRatio}
                      onChange={e => setSelectedRatio(e.target.value)}
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm text-foreground focus:border-accent"
                    >
                      {RATIO_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <textarea
                    value={customNotes}
                    onChange={e => setCustomNotes(e.target.value)}
                    rows={4}
                    placeholder="Describe the shot — lighting, pose, mood, environment… (optional)"
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm leading-relaxed resize-none focus:border-accent placeholder:text-muted-foreground/40"
                  />
                </div>
              )}
            </RailSection>

            {/* Wardrobe */}
            <RailSection label="Wardrobe">
              {wardrobeKit ? (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex gap-1 shrink-0">
                      {[...new Set(wardrobeKit.items.map(i => i.primaryColor))].slice(0, 4).map((c, i) => (
                        <div key={i} className="size-5 rounded-full border border-white/10"
                          style={{ backgroundColor: PALETTE.find(p => p.id === c)?.hex ?? "#888" }} />
                      ))}
                      {wardrobeKit.mode === "upload" && <div className="size-5 rounded-full bg-secondary flex items-center justify-center text-[8px]">📷</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wardrobeKit.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{wardrobeKit.sport}</p>
                    </div>
                    <button onClick={() => setSelectedWardrobeId("")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  <div className="border-t border-border px-3 py-1.5">
                    <button onClick={() => setShowWardrobePicker(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Change →
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowWardrobePicker(true)}
                  className="w-full h-10 rounded-lg border-2 border-dashed border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="size-3.5" strokeWidth={1.75} /> Select wardrobe kit
                </button>
              )}
            </RailSection>

            {/* Moodboard */}
            <RailSection label="Moodboard">
              {moodboard ? (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    {/* Mini image collage */}
                    <div className="flex shrink-0 gap-0.5">
                      {moodboard.sources.filter(s => s.thumbnail.startsWith("data:image/")).slice(0, 2).map(s => (
                        <div key={s.id} className="size-9 rounded overflow-hidden bg-secondary">
                          <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {moodboard.sources.filter(s => s.thumbnail.startsWith("data:image/")).length === 0 && (
                        <div className="size-9 rounded bg-secondary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{moodboard.name}</p>
                      {moodboard.direction?.mood && (
                        <p className="text-[11px] text-muted-foreground truncate capitalize">{moodboard.direction.mood}</p>
                      )}
                    </div>
                    <button onClick={() => setSelectedMoodboardId("")}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <X className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  <div className="border-t border-border px-3 py-1.5">
                    <button onClick={() => setShowMoodboardPicker(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Change →
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowMoodboardPicker(true)}
                  className="w-full h-10 rounded-lg border-2 border-dashed border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="size-3.5" strokeWidth={1.75} /> Set creative direction
                </button>
              )}
            </RailSection>

            {/* Advanced */}
            <div>
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <span>Advanced</span>
                <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">

                  {/* Aspect ratio — only shown for pack mode (oneoff has it inline) */}
                  {promptMode === "pack" && (
                    <RailSection label="Aspect ratio">
                      <select
                        value={selectedRatio}
                        onChange={e => setSelectedRatio(e.target.value)}
                        className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm text-foreground focus:border-accent"
                      >
                        {RATIO_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </RailSection>
                  )}

                  {/* Video quality / duration */}
                  {mode === "video" && (
                    <>
                      <RailSection label="Video quality">
                        <div className="space-y-1">
                          {VIDEO_TIERS.map(t => (
                            <button
                              key={t.id}
                              onClick={() => setVideoTierId(t.id)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                                videoTierId === t.id
                                  ? "border-accent bg-accent/5"
                                  : "border-border bg-card hover:border-accent/40"
                              }`}
                            >
                              <p className="text-xs font-medium">{t.label}</p>
                              <span className="text-xs text-muted-foreground">{t.cost}</span>
                            </button>
                          ))}
                        </div>
                      </RailSection>
                      <RailSection label="Duration">
                        <div className="flex gap-1.5">
                          {VIDEO_DURATIONS.map(d => (
                            <button
                              key={d}
                              onClick={() => setVideoDuration(d)}
                              className={`h-8 px-3 rounded-md text-xs border transition-colors ${
                                videoDuration === d
                                  ? "bg-secondary border-border text-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground bg-card"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </RailSection>
                    </>
                  )}

                  {/* Seed */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Fixed seed</p>
                      <button
                        onClick={() => setRandomSeed(s => !s)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!randomSeed ? "bg-accent" : "bg-border"}`}
                      >
                        <span className={`inline-block size-3.5 rounded-full bg-white transition-transform ${!randomSeed ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {!randomSeed && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={seedValue}
                          onChange={e => setSeedValue(parseInt(e.target.value) || 0)}
                          className="flex-1 h-8 px-3 bg-card border border-border rounded-md text-sm focus:border-accent"
                        />
                        <button
                          onClick={() => setSeedValue(Math.floor(Math.random() * 99999))}
                          className="h-8 px-2.5 rounded-md bg-card border border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Shuffle
                        </button>
                      </div>
                    )}
                    {capturedSeed !== undefined && (
                      <p className="text-[11px] text-muted-foreground">Last seed: {capturedSeed}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────────── */}
        <div className="border-t border-border p-4 space-y-2.5 shrink-0">
          {/* Identity readiness warning — shown when athlete profile is weak but generation is not blocked */}
          {(() => {
            if (!athlete) return null;
            const ar = calculateIdentityReadiness(getAthleteProfile(athlete.id));
            if (ar.status === "campaign_ready" || ar.status === "usable") return null;
            const isUnstable = ar.status === "unstable";
            return (
              <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
                isUnstable
                  ? "bg-orange-500/8 border-orange-500/20 text-orange-400/90"
                  : "bg-amber-500/8 border-amber-500/20 text-amber-400/90"
              }`}>
                <AlertCircle className="size-3.5 shrink-0 mt-px" strokeWidth={1.75} />
                <div className="min-w-0">
                  <span className="font-medium">{isUnstable ? "Unstable profile" : "Incomplete profile"} · </span>
                  {ar.recommendedNextAction}
                </div>
              </div>
            );
          })()}

          {genState === "done" && !added && (
            /* Campaign assignment */
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Add to campaign</p>
              {projects.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={targetCampaignId}
                    onChange={e => setTargetCampaignId(e.target.value)}
                    className="flex-1 h-9 px-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:border-accent"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddToCampaign}
                    disabled={!targetCampaignId}
                    className="h-9 px-3 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
                  No active campaigns — create one in Campaigns.
                </p>
              )}
            </div>
          )}

          {genState === "done" && added && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <Check className="size-3.5 shrink-0" strokeWidth={2} />
              Added to {projects.find(p => p.id === targetCampaignId)?.name ?? "campaign"}
            </div>
          )}

          {/* Pack CTA — shown when pack mode is active */}
          {promptMode === "pack" && (
            packSubmitting ? (
              <div className="w-full h-10 rounded-lg bg-card border border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 rounded-full bg-accent pulse-dot" />
                Queuing{packProgress ? ` ${packProgress.current}/${packProgress.total}` : ""}…
              </div>
            ) : (
              <button
                onClick={handlePackGenerate}
                disabled={!canGeneratePack}
                className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="size-4" strokeWidth={2} />
                {selectedPack
                  ? `Generate Pack — ${packImages} images · ${packCredits}cr`
                  : "Select a pack above"}
              </button>
            )
          )}

          {/* Primary CTA — shown for image/video/custom modes */}
          {promptMode !== "pack" && (genState === "idle" || settingsChanged) && (
            <button
              onClick={runGeneration}
              disabled={!canGenerateNow}
              className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="size-4" strokeWidth={2} />
              {mode === "image" ? "Generate image" : "Generate video"}
            </button>
          )}

          {promptMode !== "pack" && genState === "generating" && (
            <div className="w-full h-10 rounded-lg bg-card border border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent pulse-dot" />
              {Math.round(Math.min(genProgress, 100))}% — generating
            </div>
          )}

          {promptMode !== "pack" && genState === "done" && !settingsChanged && (
            <button
              onClick={runGeneration}
              disabled={!canGenerateNow}
              className="w-full h-9 rounded-lg border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.75} /> Regenerate
            </button>
          )}

          {promptMode !== "pack" && !canGenerateNow && (genState === "idle" || settingsChanged) && (
            <p className="text-center text-xs text-muted-foreground">
              {!athlete ? "Select a talent to generate" : ""}
            </p>
          )}
        </div>
      </aside>

      {/* ── Subject picker modal ─────────────────────────────────────────────── */}
      {showSubjectPicker && (
        <div onClick={() => setShowSubjectPicker(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <h2 className="text-sm font-semibold">Select talent</h2>
              <button onClick={() => setShowSubjectPicker(false)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder="Search talent…"
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 h-9 bg-card border border-border rounded-lg text-sm focus:border-accent placeholder:text-muted-foreground/50"
                />
              </div>
              {athletes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No talent yet — add one in Talent.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
                  {athletes
                    .filter(a => a.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                    .map(a => {
                      const ar = calculateIdentityReadiness(getAthleteProfile(a.id));
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setSelectedAthleteId(a.id); setShowSubjectPicker(false); setSubjectSearch(""); }}
                          className={`group rounded-lg overflow-hidden text-left border transition-colors ${
                            selectedAthleteId === a.id ? "border-accent" : "border-border hover:border-accent/40"
                          }`}
                        >
                          <div className="aspect-square overflow-hidden relative">
                            <img src={a.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : a.image} alt={a.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                            <div className="absolute top-1.5 right-1.5">
                              <ReadinessBadge status={ar.status} variant="dot" />
                            </div>
                          </div>
                          <div className="p-2 bg-card">
                            <p className="text-xs font-medium truncate">{a.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.sport}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Wardrobe picker modal ────────────────────────────────────────────── */}
      {showWardrobePicker && (
        <div onClick={() => { setShowWardrobePicker(false); setWardrobePickerTab("browse"); setWardrobeCreateName(""); setWardrobeCreateUrls([]); }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-xl w-full max-w-md overflow-hidden flex flex-col max-h-[82vh]">
            <div className="px-4 h-12 flex items-center justify-between border-b border-border shrink-0">
              <h2 className="text-sm font-semibold">Wardrobe</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => setWardrobePickerTab("browse")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${wardrobePickerTab === "browse" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Browse</button>
                <button onClick={() => setWardrobePickerTab("create")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${wardrobePickerTab === "create" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>+ New</button>
                <button onClick={() => { setShowWardrobePicker(false); setWardrobePickerTab("browse"); }} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary ml-1">
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {wardrobePickerTab === "create" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Kit name</p>
                  <input
                    autoFocus
                    type="text"
                    value={wardrobeCreateName}
                    onChange={e => setWardrobeCreateName(e.target.value)}
                    placeholder="e.g. Nike Match Kit 2025"
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-sm focus:border-accent placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Garment photos <span className="text-muted-foreground/50">(select multiple)</span></p>
                  <label className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/40 transition-colors bg-card">
                    <Upload className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
                    <span className="text-xs text-muted-foreground">Click to upload images</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
                      const files = Array.from(e.target.files ?? []);
                      const urls: string[] = [];
                      for (const f of files) {
                        await new Promise<void>(res => {
                          const reader = new FileReader();
                          reader.onload = ev => { urls.push(ev.target?.result as string); res(); };
                          reader.readAsDataURL(f);
                        });
                      }
                      setWardrobeCreateUrls(prev => [...prev, ...urls]);
                    }} />
                  </label>
                  {wardrobeCreateUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {wardrobeCreateUrls.map((url, i) => (
                        <div key={i} className="relative group size-16 rounded-md overflow-hidden border border-border bg-secondary">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setWardrobeCreateUrls(p => p.filter((_, j) => j !== i))}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X className="size-3.5 text-white" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  disabled={!wardrobeCreateName.trim() || wardrobeCreateUrls.length === 0}
                  onClick={() => {
                    const kit: WardrobeKit = {
                      id: `wk-${crypto.randomUUID().slice(0, 8)}`,
                      name: wardrobeCreateName.trim(),
                      mode: "upload",
                      sport: "generic",
                      items: [],
                      uploadDataUrls: wardrobeCreateUrls,
                      uploadDataUrl: wardrobeCreateUrls[0],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    addWardrobeKit(kit);
                    setSelectedWardrobeId(kit.id);
                    setShowWardrobePicker(false);
                    setWardrobePickerTab("browse");
                    setWardrobeCreateName("");
                    setWardrobeCreateUrls([]);
                  }}
                  className="w-full h-9 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Save wardrobe kit
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <button
                  onClick={() => { setSelectedWardrobeId(""); setShowWardrobePicker(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    !selectedWardrobeId ? "border-accent bg-accent/5" : "border-border hover:border-accent/30 bg-card"
                  }`}
                >
                  <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <X className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No wardrobe</p>
                    <p className="text-[11px] text-muted-foreground">Use recipe or prompt styling only</p>
                  </div>
                  {!selectedWardrobeId && <Check className="size-3.5 text-accent ml-auto" strokeWidth={2.5} />}
                </button>

                {wardrobeKits.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">No kits yet</p>
                    <button onClick={() => setWardrobePickerTab("create")} className="text-xs text-accent hover:underline mt-1">Create your first kit →</button>
                  </div>
                )}

                {wardrobeKits.map(kit => {
                  const colorDots = [...new Set(kit.items.map(i => i.primaryColor))].slice(0, 5);
                  const previewUrls = kit.uploadDataUrls ?? (kit.uploadDataUrl ? [kit.uploadDataUrl] : []);
                  return (
                    <button
                      key={kit.id}
                      onClick={() => { setSelectedWardrobeId(kit.id); setShowWardrobePicker(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                        selectedWardrobeId === kit.id
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/30 bg-card hover:bg-secondary/20"
                      }`}
                    >
                      <div className="flex gap-1 shrink-0">
                        {kit.mode === "upload" && previewUrls.length > 0
                          ? previewUrls.slice(0, 3).map((url, i) => (
                              <div key={i} className="size-8 rounded-md bg-secondary overflow-hidden shrink-0">
                                <img src={url} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))
                          : colorDots.map((c, i) => (
                              <div key={i} className="size-5 rounded-full border border-white/10"
                                style={{ backgroundColor: PALETTE.find(p => p.id === c)?.hex ?? "#888" }} />
                            ))
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{kit.name}</p>
                          {selectedWardrobeId === kit.id && <Check className="size-3 text-accent shrink-0" strokeWidth={2.5} />}
                        </div>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {kit.mode === "upload" ? `${previewUrls.length} photo${previewUrls.length !== 1 ? "s" : ""} · image ref` : `${kit.items.length} items · builder`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Moodboard picker modal ───────────────────────────────────────────── */}
      {showMoodboardPicker && (
        <div onClick={() => { setShowMoodboardPicker(false); setMoodboardPickerTab("browse"); setMoodboardCreateName(""); setMoodboardCreateUrls([]); }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
              <p className="text-sm font-semibold">Moodboard</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setMoodboardPickerTab("browse")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${moodboardPickerTab === "browse" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Browse</button>
                <button onClick={() => setMoodboardPickerTab("create")} className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors ${moodboardPickerTab === "create" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>+ New</button>
                <button onClick={() => { setShowMoodboardPicker(false); setMoodboardPickerTab("browse"); }} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary ml-1">
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {moodboardPickerTab === "create" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Moodboard name</p>
                  <input
                    autoFocus
                    type="text"
                    value={moodboardCreateName}
                    onChange={e => setMoodboardCreateName(e.target.value)}
                    placeholder="e.g. Dark editorial, summer vibes…"
                    className="w-full h-9 px-3 bg-card border border-border rounded-lg text-sm focus:border-accent placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Inspiration images <span className="text-muted-foreground/50">(select multiple)</span></p>
                  <label className="flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/40 transition-colors bg-card">
                    <Upload className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
                    <span className="text-xs text-muted-foreground">Click to upload inspiration images</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
                      const files = Array.from(e.target.files ?? []);
                      const urls: string[] = [];
                      for (const f of files) {
                        await new Promise<void>(res => {
                          const reader = new FileReader();
                          reader.onload = ev => { urls.push(ev.target?.result as string); res(); };
                          reader.readAsDataURL(f);
                        });
                      }
                      setMoodboardCreateUrls(prev => [...prev, ...urls]);
                    }} />
                  </label>
                  {moodboardCreateUrls.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {moodboardCreateUrls.map((url, i) => (
                        <div key={i} className="relative group size-16 rounded-md overflow-hidden border border-border bg-secondary">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setMoodboardCreateUrls(p => p.filter((_, j) => j !== i))}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X className="size-3.5 text-white" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  disabled={!moodboardCreateName.trim()}
                  onClick={() => {
                    const mb: Moodboard = {
                      id: `mb-${crypto.randomUUID().slice(0, 8)}`,
                      name: moodboardCreateName.trim(),
                      sources: moodboardCreateUrls.map((thumbnail, i) => ({
                        id: `src-${i}`, thumbnail,
                      })),
                      direction: null,
                      notes: "",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    addMoodboard(mb);
                    setSelectedMoodboardId(mb.id);
                    setShowMoodboardPicker(false);
                    setMoodboardPickerTab("browse");
                    setMoodboardCreateName("");
                    setMoodboardCreateUrls([]);
                  }}
                  className="w-full h-9 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Save moodboard
                </button>
              </div>
            ) : (
              <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
                <button
                  onClick={() => { setSelectedMoodboardId(""); setShowMoodboardPicker(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    !selectedMoodboardId ? "border-accent bg-accent/5" : "border-border hover:border-accent/30 bg-card"
                  }`}
                >
                  <p className="text-sm text-muted-foreground">No moodboard</p>
                  {!selectedMoodboardId && <Check className="size-3 text-accent ml-auto" strokeWidth={2.5} />}
                </button>
                {moodboards.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground">No moodboards yet</p>
                    <button onClick={() => setMoodboardPickerTab("create")} className="text-xs text-accent hover:underline mt-1">Create your first moodboard →</button>
                  </div>
                ) : moodboards.map(mb => {
                  const previewImgs = mb.sources.filter(s => s.thumbnail.startsWith("data:image/")).slice(0, 2);
                  return (
                    <button
                      key={mb.id}
                      onClick={() => { setSelectedMoodboardId(mb.id); setShowMoodboardPicker(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                        selectedMoodboardId === mb.id
                          ? "border-accent bg-accent/5"
                          : "border-border hover:border-accent/30 bg-card hover:bg-secondary/20"
                      }`}
                    >
                      <div className="flex gap-0.5 shrink-0">
                        {previewImgs.length > 0
                          ? previewImgs.map(s => (
                              <div key={s.id} className="size-8 rounded overflow-hidden bg-secondary">
                                <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))
                          : <div className="size-8 rounded bg-secondary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{mb.name}</p>
                          {selectedMoodboardId === mb.id && <Check className="size-3 text-accent shrink-0" strokeWidth={2.5} />}
                        </div>
                        {mb.direction?.mood && (
                          <p className="text-[11px] text-muted-foreground truncate capitalize">{mb.direction.mood}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function RailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

