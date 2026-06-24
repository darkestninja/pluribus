import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
// Heavy page components — lazy loaded to split the main bundle
const AthleteLibrary      = lazy(() => import("./components/AthleteLibrary").then(m => ({ default: m.AthleteLibrary })));
const LibraryPage         = lazy(() => import("./components/LibraryPage").then(m => ({ default: m.LibraryPage })));
const Workspace           = lazy(() => import("./components/Workspace").then(m => ({ default: m.Workspace })));
const WardrobeLibrary     = lazy(() => import("./components/WardrobeLibrary").then(m => ({ default: m.WardrobeLibrary })));
const MoodboardLibrary    = lazy(() => import("./components/MoodboardLibrary").then(m => ({ default: m.MoodboardLibrary })));
const IdentityStudio      = lazy(() => import("./components/IdentityStudio").then(m => ({ default: m.IdentityStudio })));
const QueuePage           = lazy(() => import("./components/QueuePage").then(m => ({ default: m.QueuePage })));
const ArchivePage         = lazy(() => import("./components/ArchivePage").then(m => ({ default: m.ArchivePage })));
// Always-present components — loaded eagerly
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { Projects } from "./components/Projects";
import { CommandPalette } from "./components/CommandPalette";
import { Onboarding } from "./components/Onboarding";
import { AuthScreen } from "./components/AuthScreen";
import { ReviewPage } from "./components/ReviewPage";
import { SubjectPortal } from "./components/SubjectPortal";
import { DebugPanel } from "./components/DebugPanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NewCampaignModal } from "./components/NewCampaignModal";
import { AddAthleteModal } from "./components/AddAthleteModal";
import {
  Search, Moon, Sun, Plus, Settings as SettingsIcon,
  Home, Folder, Users, Images, PanelLeft, Menu, X,
  CheckCircle, AlertCircle, Info, LogOut, Shirt, Palette, ScanFace, ChevronUp,
  Bell, HelpCircle, Sparkles,
} from "lucide-react";
import { RenderQueueIcon } from "./components/icons/RenderQueueIcon";
import { getProjects, getRuns, isOnboarded, setOnboarded, initStore, clearStore, hydrateStore, getUserRole, addProject, getJobs, updateJob, updateRun, addCampaignOutput, getPendingScoringOutputs, scoreOutputWithRetry, getAthletes, getCanonicalReferencesSync, getAthleteProfile, setWriteErrorHandler } from "./lib/store";
import { pollGenerationStatus, fetchGenerationResult } from "./lib/generate";
import { onToast, Toast } from "./lib/notifications";
import { supabase, toAppUser, signOut } from "./lib/auth";
import type { AppUser } from "./lib/auth";
import type { Project } from "../data/projects";

type ViewType = "home" | "studio" | "projects" | "subjects" | "wardrobe" | "moodboards" | "identity" | "library" | "queue" | "archive" | "settings";

const PAGE_TITLES: Record<ViewType, string> = {
  home:      "Home",
  studio:    "Studio",
  projects:  "Campaigns",
  subjects:  "Talent",
  wardrobe:  "Wardrobe",
  moodboards:"Moodboards",
  identity:  "Identity Studio",
  library:   "Library",
  queue:     "Runs",
  archive:   "Archive",
  settings:  "Settings",
};

const VIEW_HASH: Record<ViewType, string> = {
  home:      "#/home",
  studio:    "#/studio",
  projects:  "#/campaigns",
  subjects:  "#/subjects",
  wardrobe:  "#/wardrobe",
  moodboards:"#/moodboards",
  identity:  "#/identity",
  library:   "#/library",
  queue:     "#/queue",
  archive:   "#/archive",
  settings:  "#/settings",
};
const HASH_VIEW: Record<string, ViewType> = Object.fromEntries(
  Object.entries(VIEW_HASH).map(([v, h]) => [h.slice(1), v as ViewType])
);

// Detect shareable public routes at module load — values are stable for the page lifetime.
const _reviewToken = (() => {
  const m = window.location.pathname.match(/^\/review\/([a-f0-9]{32})$/);
  return m?.[1] ?? null;
})();

const _subjectToken = (() => {
  const m = window.location.pathname.match(/^\/subject\/([a-zA-Z0-9_-]{16,})$/);
  return m?.[1] ?? null;
})();

// Set VITE_BYPASS_AUTH=true in .env.local to skip Supabase auth during dev.
// Never set this in production — it boots as an anonymous guest with no Supabase writes.
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === "true";
const GUEST_USER = { id: "guest", email: "guest@local" };

// Top-level shell: routes to public pages (no auth) or the full authenticated app.
export default function App() {
  if (_reviewToken)  return <ReviewPage token={_reviewToken} />;
  if (_subjectToken) return <SubjectPortal token={_subjectToken} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [authed, setAuthed] = useState(BYPASS_AUTH);
  const [sessionLoading, setSessionLoading] = useState(!BYPASS_AUTH);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    // Strip leading "#" then query params before HASH_VIEW lookup.
    // e.g. "#/studio?c=abc" → "/studio" → "studio"
    const path = window.location.hash.slice(1).split("?")[0];
    return (HASH_VIEW[path] as ViewType) ?? "home";
  });
  // Tracks whether the current view change originated from a URL event (back/forward)
  // so the write-hash effect knows not to push a duplicate history entry.
  const fromUrlRef = useRef(false);
  const [isDark, setIsDark] = useState(true);
  // Restore workspace from URL on refresh: #/studio?c=<id>
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(() => {
    const m = window.location.hash.match(/[?&]c=([^&]+)/);
    return m?.[1] ?? null;
  });
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [activeRenders, setActiveRenders] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<{ athleteId?: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Global modals
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [showAddAthleteModal, setShowAddAthleteModal] = useState(false);

  // Persist created campaigns so they appear immediately
  const [extraProjects, setExtraProjects] = useState<Project[]>([]);

  const user = appUser;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Push a history entry whenever the view changes via user navigation.
  // Skip if the change itself came from a URL event (back/forward) to avoid duplicates.
  useEffect(() => {
    if (fromUrlRef.current) { fromUrlRef.current = false; return; }
    let next = VIEW_HASH[currentView];
    if (currentView === "studio" && selectedWorkspace && selectedWorkspace !== "new") {
      next = `#/studio?c=${selectedWorkspace}`;
    }
    if (next && window.location.hash !== next) history.pushState(null, "", next);
  }, [currentView, selectedWorkspace]);

  // Handle browser back / forward (both hashchange and popstate fire depending on browser).
  useEffect(() => {
    const onNav = () => {
      const path = window.location.hash.slice(1).split("?")[0];
      const v = HASH_VIEW[path] as ViewType | undefined;
      if (v && v !== currentView) {
        fromUrlRef.current = true;
        setCurrentView(v);
        // Also restore workspace when navigating back to studio
        if (v === "studio") {
          const m = window.location.hash.match(/[?&]c=([^&]+)/);
          if (m?.[1]) setSelectedWorkspace(m[1]);
        }
      }
    };
    window.addEventListener("hashchange", onNav);
    window.addEventListener("popstate", onNav);
    return () => { window.removeEventListener("hashchange", onNav); window.removeEventListener("popstate", onNav); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  // Restore session and subscribe to future auth state changes
  useEffect(() => {
    if (BYPASS_AUTH) {
      initStore(GUEST_USER.id, GUEST_USER.email);
      setAppUser({ id: GUEST_USER.id, email: GUEST_USER.email, name: "Guest", avatarInitials: "G" });
      setWriteErrorHandler(() => toast({ type: "warning", title: "Saved locally", body: "Will sync when reconnected." }));
      return;
    }

    setWriteErrorHandler(() => toast({ type: "warning", title: "Saved locally", body: "Will sync when reconnected." }));

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        initStore(session.user.id, session.user.email ?? "");
        await hydrateStore(session.user.id);
        setIsAdmin(getUserRole() === "admin");
      }
      setAuthed(!!session);
      setAppUser(session?.user ? toAppUser(session.user) : null);
      if (session) setShowOnboarding(!isOnboarded());
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Skip initStore on pure token-refresh — user hasn't changed, channel is fine
        if (event !== "TOKEN_REFRESHED") {
          initStore(session.user.id, session.user.email ?? "");
        }
      } else {
        clearStore();
      }
      setAuthed(!!session);
      setAppUser(session?.user ? toAppUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Drain any outputs left in "pending" scoring state from a previous session.
  // Runs once after auth resolves so orphaned outputs get scored on next app open.
  useEffect(() => {
    if (!authed) return;
    const pending = getPendingScoringOutputs();
    if (pending.length === 0) return;
    const athletes = getAthletes();
    for (const output of pending) {
      const athlete = athletes.find(a => a.id === output.athleteId);
      const profile = output.athleteId ? getAthleteProfile(output.athleteId) : null;
      const refs = getCanonicalReferencesSync(profile);
      const referenceUrl = refs[0] ?? athlete?.image;
      const generatedUrl = output.originalFalUrl ?? output.url;
      if (referenceUrl && generatedUrl) {
        scoreOutputWithRetry(output.id, referenceUrl, generatedUrl).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    const tick = () => {
      const projects = getProjects();
      let n = 0;
      for (const p of projects) n += getRuns(p.id).filter(r => r.status === "running").length;
      // also count active generation jobs not tied to a campaign run
      n += getJobs().filter(j => j.status === "queued" || j.status === "running").length;
      setActiveRenders(n);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  // Global background poller — drives progress for all queued/running generation jobs
  // regardless of which page the user is currently on.
  useEffect(() => {
    if (!authed) return;
    const poll = async () => {
      const now = Date.now();
      const active = getJobs().filter(j =>
        (j.status === "queued" || j.status === "running") &&
        (!j.rateRetryAfter || now >= j.rateRetryAfter)
      );
      for (const job of active) {
        try {
          const { status } = await pollGenerationStatus(job.modelId, job.requestId);

          // Time-based progress: NB Pro typically completes in 20-45s.
          // Advance smoothly 5→85% over 35s regardless of log output.
          // Log-based % (if ever present) wins if higher, but never goes backward.
          const elapsedSec = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
          const EXPECTED_SEC = 35;
          const timeProgress = status === "IN_QUEUE"
            ? Math.min(10, Math.round((elapsedSec / EXPECTED_SEC) * 20))
            : Math.min(85, Math.round(5 + (elapsedSec / EXPECTED_SEC) * 80));
          const nextProgress = Math.max(job.progress, timeProgress);

          if (status === "COMPLETED") {
            const images = await fetchGenerationResult(job.modelId, job.requestId);
            // Basic content filter: discard any results that fal flagged as NSFW
            const urls = images
              .filter(i => !(i as { nsfw?: boolean }).nsfw)
              .map(i => i.url);
            const now = new Date().toISOString();
            updateJob(job.id, { status: "complete", progress: 100, resultUrls: urls, completedAt: now });
            if (job.runId && job.campaignId) {
              updateRun(job.campaignId, job.runId, { status: "complete", completedAt: now, assetIds: [] });
            }
            // Auto-persist result so it survives navigation regardless of user action
            if (urls.length > 0) {
              const outputId = `out-${crypto.randomUUID().slice(0, 8)}`;
              addCampaignOutput({
                id:            outputId,
                campaignId:    job.campaignId ?? "studio",
                athleteId:     job.subjectId,
                runId:         job.runId,
                url:           urls[0],
                originalFalUrl: urls[0],
                status:        "pending",
                createdAt:     now,
              });
              if (job.runId && job.campaignId) {
                updateRun(job.campaignId, job.runId, { assetIds: [outputId] });
              }
              // Mirror to Supabase Storage non-blocking
              import("./lib/storage").then(({ mirrorAsset }) => {
                const path = `${job.subjectId ?? "unknown"}/${outputId}.jpg`;
                mirrorAsset(urls[0], path).then(mirrored => {
                  if (mirrored?.signedUrl) {
                    import("./lib/store").then(({ updateCampaignOutput }) => {
                      updateCampaignOutput(outputId, { url: mirrored.signedUrl, storagePath: mirrored.path });
                    });
                  }
                }).catch(() => {});
              });
            }
            toast({ type: "success", title: `${job.subjectName ?? "Generation"} ready`, body: "View it in Runs." });
          } else if (status === "FAILED") {
            updateJob(job.id, { status: "failed", error: "Generation failed" });
            if (job.runId && job.campaignId) {
              updateRun(job.campaignId, job.runId, { status: "failed", errorMessage: "Generation failed" });
            }
            toast({ type: "error", title: "Generation failed", body: job.subjectName ?? "See Studio for details." });
          } else {
            updateJob(job.id, { status: status === "IN_QUEUE" ? "queued" : "running", progress: nextProgress });
          }
        } catch (err) {
          // 429 rate limit — back off 30s before retrying this job
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            updateJob(job.id, { rateRetryAfter: Date.now() + 30_000 });
            toast({ type: "warning", title: "Rate limited", body: "Generation paused 30s, will resume automatically." });
          }
          // other network hiccup — retry next tick
        }
      }
    };
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [authed]);

  useEffect(() => {
    return onToast(t => {
      setToasts(prev => [...prev, t]);
      const dur = t.duration ?? 4000;
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), dur);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen(o => !o); }
      if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        if (mobileSidebarOpen) setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, mobileSidebarOpen]);

  const toggleSidebar = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  const goToStudio = useCallback((opts?: { athleteId?: string; workspaceId?: string }) => {
    setPendingPrefill(opts?.athleteId ? { athleteId: opts.athleteId } : null);
    setSelectedWorkspace(opts?.workspaceId ?? "new");
    setCurrentView("studio");
  }, []);

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    setMobileSidebarOpen(false);
  };

  const handleSignOut = () => {
    signOut(); // triggers onAuthStateChange → sets authed false automatically
    setShowOnboarding(false);
  };

  const handleAuth = () => {
    // onAuthStateChange handles setAuthed; just trigger onboarding check
    setShowOnboarding(!isOnboarded());
  };

  const handleCampaignCreated = (project: Project) => {
    addProject(project);
    setExtraProjects(prev => [project, ...prev]);
    setCurrentView("projects");
    setShowNewCampaignModal(false);
  };

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const navItems = useMemo(() => [
    { view: "home"       as const, label: "Home",             icon: Home      },
    { view: "projects"   as const, label: "Campaigns",        icon: Folder    },
    { view: "subjects"   as const, label: "Talent",           icon: Users     },
    { view: "wardrobe"   as const, label: "Wardrobe",         icon: Shirt     },
    { view: "moodboards" as const, label: "Moodboards",       icon: Palette   },
    { view: "library"    as const, label: "Library",          icon: Images    },
    { view: "queue"      as const, label: "Runs",             icon: RenderQueueIcon, badge: activeRenders },
    ...(isAdmin ? [{ view: "identity" as const, label: "Identity Studio", icon: ScanFace }] : []),
  ], [isAdmin, activeRenders]);

  const renderNavItem = (
    view: ViewType,
    label: string,
    Icon: React.ElementType,
    badge: number | undefined,
    collapsed: boolean
  ) => {
    const active = currentView === view;
    if (collapsed) {
      return (
        <button
          key={view}
          onClick={() => navigateTo(view)}
          title={label}
          aria-current={active ? "page" : undefined}
          className={`relative w-full flex items-center justify-center h-8 rounded-md transition-colors ${
            active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <Icon className="size-4" strokeWidth={1.75} />
          {badge !== undefined && badge > 0 && (
            <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent" />
          )}
        </button>
      );
    }
    return (
      <button
        key={view}
        onClick={() => navigateTo(view)}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md transition-colors text-left ${
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
        }`}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="text-sm flex-1 truncate">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="flex items-center gap-1 text-xs text-accent">
            <span className="size-1.5 rounded-full bg-accent pulse-dot" />
            {badge}
          </span>
        )}
      </button>
    );
  };

  const sidebarInner = (collapsed: boolean) => (
    <>
      {/* Brand */}
      <div className={`h-14 flex items-center shrink-0 ${collapsed ? "justify-center px-2" : "px-3 gap-2"}`}>
        <div className="size-2 rounded-full bg-accent shrink-0" />
        {!collapsed && <span className="text-sm font-semibold tracking-tight flex-1">Pluribus</span>}
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden md:flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
        >
          <PanelLeft className={`size-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} strokeWidth={1.75} />
        </button>
      </div>

      {/* Quick actions: Home + Search pill | New render */}
      {!collapsed && (
        <div className="px-2.5 pb-3 flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-border bg-card overflow-hidden shrink-0">
            <button
              onClick={() => { navigateTo("home"); setMobileSidebarOpen(false); }}
              title="Home"
              className={`flex items-center justify-center size-8 transition-colors ${currentView === "home" ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              <Home className="size-3.5" strokeWidth={1.75} />
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => { setPaletteOpen(true); setMobileSidebarOpen(false); }}
              title="Search (⌘K)"
              className="flex items-center justify-center size-8 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Search className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
          <button
            onClick={() => { goToStudio(); setMobileSidebarOpen(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-medium transition-colors"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            New render
          </button>
        </div>
      )}
      {collapsed && (
        <div className="px-1.5 pb-3 flex flex-col items-center gap-1.5 shrink-0">
          <button
            onClick={() => navigateTo("home")}
            title="Home"
            className={`flex items-center justify-center size-8 rounded-md transition-colors ${currentView === "home" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}
          >
            <Home className="size-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => { setPaletteOpen(true); }}
            title="Search (⌘K)"
            className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          >
            <Search className="size-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => goToStudio()}
            title="New render"
            className="flex items-center justify-center size-8 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground transition-colors"
          >
            <Plus className="size-4" strokeWidth={2.25} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className={`${collapsed ? "px-1.5" : "px-2"} flex-1 flex flex-col gap-0.5 overflow-y-auto`} aria-label="Main">
        {navItems.filter(i => i.view !== "home").map(item => renderNavItem(item.view, item.label, item.icon, item.badge, collapsed))}
      </nav>

      {/* Footer — user menu */}
      <div ref={userMenuRef} className="p-2 shrink-0 relative">

        {/* Dropdown menu — opens upward */}
        {userMenuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 rounded-lg border border-border bg-background shadow-lg overflow-hidden z-50">
            {/* Identity */}
            <div className="px-3 py-3">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user?.name ?? "User"}</p>
                {isAdmin && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
            <div className="h-px bg-border" />
            <button onClick={() => setIsDark(!isDark)}
              className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              {isDark ? <Sun className="size-4 shrink-0" strokeWidth={1.75} /> : <Moon className="size-4 shrink-0" strokeWidth={1.75} />}
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Bell className="size-4 shrink-0" strokeWidth={1.75} />
              Notifications
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <HelpCircle className="size-4 shrink-0" strokeWidth={1.75} />
              Help
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Sparkles className="size-4 shrink-0" strokeWidth={1.75} />
              Upgrade plan
            </button>
            <div className="h-px bg-border" />
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 h-9 text-sm text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors">
              <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        )}

        {/* Trigger row */}
        {collapsed ? (
          <button onClick={() => setUserMenuOpen(o => !o)} title="Account" className="w-full flex justify-center py-1 relative">
            <div className="size-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
              {user?.avatarInitials ?? "?"}
            </div>
            {isAdmin && <span className="absolute top-0 right-1.5 size-2.5 rounded-full bg-amber-400 border border-background" title="Admin" />}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            {/* Avatar + name + chevron */}
            <button
              onClick={() => setUserMenuOpen(o => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-card transition-colors flex-1 min-w-0"
            >
              <div className="size-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                {user?.avatarInitials ?? "?"}
              </div>
              <span className="text-sm font-medium truncate flex-1 text-left">{user?.name ?? "User"}</span>
              <ChevronUp className={`size-3.5 text-muted-foreground shrink-0 transition-transform duration-150 ${userMenuOpen ? "" : "rotate-180"}`} strokeWidth={1.75} />
            </button>
            {/* Settings shortcut */}
            <button
              onClick={() => { navigateTo("settings"); setUserMenuOpen(false); }}
              title="Settings"
              className={`size-7 flex items-center justify-center rounded-md transition-colors shrink-0 ${currentView === "settings" ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
            >
              <SettingsIcon className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </>
  );

  // ── Session loading / auth gate ───────────────────────────
  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="size-2 rounded-full bg-accent animate-pulse" />
      </div>
    );
  }

  if (!authed) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className="size-full flex bg-background text-foreground overflow-hidden">
      {/* Onboarding overlay */}
      {showOnboarding && (
        <Onboarding
          onComplete={(athleteId) => {
            setOnboarded();
            setShowOnboarding(false);
            goToStudio({ athleteId });
          }}
          onSkip={() => {
            setOnboarded();
            setShowOnboarding(false);
          }}
        />
      )}

      {/* Global modals */}
      {showNewCampaignModal && (
        <NewCampaignModal
          onClose={() => setShowNewCampaignModal(false)}
          onCreate={handleCampaignCreated}
        />
      )}
      {showAddAthleteModal && (
        <AddAthleteModal
          onClose={() => setShowAddAthleteModal(false)}
          onAdded={() => setShowAddAthleteModal(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`${sidebarCollapsed ? "w-14" : "w-[208px]"} bg-secondary/30 flex-col shrink-0 hidden md:flex transition-[width] duration-200 ease-out overflow-hidden`}
      >
        {sidebarInner(sidebarCollapsed)}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="w-[208px] bg-secondary/30 flex flex-col shrink-0 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-3.5 right-3 z-10 size-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
            {sidebarInner(false)}
          </aside>
          <div className="flex-1 bg-black/50" />
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-secondary/30 px-4 md:px-1 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden flex items-center justify-center size-8 rounded-md text-muted-foreground hover:bg-card hover:text-foreground transition-colors shrink-0"
            >
              <Menu className="size-4" strokeWidth={1.75} />
            </button>
            <h1 className="text-base font-semibold tracking-tight truncate">{PAGE_TITLES[currentView]}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeRenders > 0 && (() => {
              const jobs = getJobs().filter(j => j.status === "queued" || j.status === "running");
              const totalSlots = jobs.reduce((n, j) => n + (j.packId ? 1 : 1), 0);
              const avgPct = totalSlots > 0 ? Math.round(jobs.reduce((s, j) => s + j.progress, 0) / totalSlots) : 0;
              const estRemSec = avgPct > 0 && avgPct < 100 ? Math.round(35 * (1 - avgPct / 100)) : null;
              return (
                <button
                  onClick={() => setCurrentView("queue")}
                  className="hidden sm:flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="size-1.5 rounded-full bg-accent pulse-dot shrink-0" />
                  {totalSlots === 1
                    ? `${avgPct}%${estRemSec ? ` · ~${estRemSec}s` : ""}`
                    : `${jobs.filter(j => j.progress === 100).length}/${totalSlots} ready`}
                </button>
              );
            })()}
            <button
              onClick={() => {
                if (currentView === "projects") setShowNewCampaignModal(true);
                else if (currentView === "subjects") setShowAddAthleteModal(true);
                else if (currentView === "wardrobe") {
                  // Wardrobe has its own internal builder toggle
                  const event = new CustomEvent("openWardrobeBuilder");
                  window.dispatchEvent(event);
                }
                else if (currentView === "moodboards") {
                  // Moodboards has its own internal builder toggle
                  const event = new CustomEvent("openMoodboardBuilder");
                  window.dispatchEvent(event);
                }
                else goToStudio();
              }}
              className="h-8 px-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">
                {currentView === "projects" ? "New campaign" :
                 currentView === "subjects" ? "New talent" :
                 currentView === "wardrobe" ? "New kit" :
                 currentView === "moodboards" ? "New moodboard" :
                 "New render"}
              </span>
              <span className="sm:hidden">+</span>
            </button>
          </div>
        </header>

        {/* Content — island effect */}
        <div className="flex-1 overflow-hidden relative p-1 bg-secondary/30">
          <div className="size-full rounded-xl border border-border bg-background shadow-sm overflow-hidden relative">
          {currentView === "home" && (
            <Dashboard
              onOpenCampaigns={() => setCurrentView("projects")}
              onNewCampaign={() => setShowNewCampaignModal(true)}
              onQuickGenerate={() => goToStudio()}
              onAddAthlete={() => setShowAddAthleteModal(true)}
              onAthleteClick={(id) => { if (id) setSelectedAthleteId(id); setCurrentView("subjects"); }}
              onAthleteGenerate={(id) => goToStudio({ athleteId: id })}
            />
          )}
          {currentView === "projects" && (
            <Projects
              onLaunchStudio={(opts) => goToStudio(opts)}
              extraProjects={extraProjects}
            />
          )}
          <ErrorBoundary>
          <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><span className="size-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>}>
          {currentView === "subjects" && (
            <AthleteLibrary
              preSelectedAthleteId={selectedAthleteId}
              onAthleteDeselect={() => setSelectedAthleteId(null)}
              onGenerate={(id) => goToStudio({ athleteId: id })}
            />
          )}
          {currentView === "library" && (
            <LibraryPage reviewerEmail={appUser?.email ?? ""} />
          )}
{currentView === "wardrobe"    && <WardrobeLibrary />}
          {currentView === "moodboards"  && <MoodboardLibrary />}
          {currentView === "identity"    && isAdmin && <IdentityStudio />}
          {currentView === "studio" && (
            <Workspace
              workspaceId={selectedWorkspace ?? "new"}
              prefill={pendingPrefill ?? undefined}
              onBack={() => {
                const isCampaign = getProjects().some(p => p.id === selectedWorkspace);
                setCurrentView(isCampaign ? "projects" : "home");
              }}
            />
          )}
          {currentView === "queue" && (
            <QueuePage
              onOpenCampaign={(campaignId) => {
                setCurrentView("projects");
              }}
              onOpenStudio={(opts) => {
                goToStudio({ athleteId: opts.athleteId, workspaceId: opts.campaignId });
              }}
            />
          )}
          {currentView === "archive" && <ArchivePage />}
          </Suspense>
          </ErrorBoundary>
          {currentView === "settings" && (
            <Settings
              appUser={appUser}
              isDark={isDark}
              onThemeChange={setIsDark}
              onSignOut={handleSignOut}
              onClose={() => setCurrentView("home")}
            />
          )}
          </div>
        </div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(v) => { setCurrentView(v); setPaletteOpen(false); }}
        onAthlete={(id) => { setSelectedAthleteId(id); setCurrentView("subjects"); setPaletteOpen(false); }}
        onGenerate={(id) => { goToStudio({ athleteId: id }); setPaletteOpen(false); }}
      />

      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto bg-popover border border-border rounded-lg shadow-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
          >
            {t.type === "success" && <CheckCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={2} />}
            {t.type === "error"   && <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />}
            {t.type === "warning" && <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={2} />}
            {t.type === "info"    && <Info className="size-4 text-accent shrink-0 mt-0.5" strokeWidth={2} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && <p className="text-xs text-muted-foreground mt-0.5">{t.body}</p>}
            </div>
            {t.action && (
              <button onClick={t.action.onClick} className="text-xs text-accent hover:underline shrink-0">
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="size-3" strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>
      <DebugPanel isAdmin={isAdmin} />
    </div>
  );
}
