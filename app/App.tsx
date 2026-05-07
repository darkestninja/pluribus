import { useState, useEffect, useMemo, useCallback } from "react";
import { Dashboard } from "./components/Dashboard";
import { AthleteLibrary } from "./components/AthleteLibrary";
import { Workspace } from "./components/Workspace";
import { Settings } from "./components/Settings";
import { WorkflowLibrary } from "./components/WorkflowLibrary";
import { Projects } from "./components/Projects";
import { QueuePage } from "./components/QueuePage";
import { ArchivePage } from "./components/ArchivePage";
import { CommandPalette } from "./components/CommandPalette";
import { Onboarding } from "./components/Onboarding";
import { AuthScreen } from "./components/AuthScreen";
import { NewCampaignModal } from "./components/NewCampaignModal";
import { AddAthleteModal } from "./components/AddAthleteModal";
import {
  Search, Moon, Sun, Plus, Settings as SettingsIcon,
  Home, Folder, Users, LayoutGrid, PanelLeft, Menu, X, Bell,
  CheckCircle, AlertCircle, Info, LogOut,
} from "lucide-react";
import { getQueue, isOnboarded, setOnboarded, initStore } from "./lib/store";
import { onToast, Toast } from "./lib/notifications";
import { supabase, toAppUser, signOut } from "./lib/auth";
import type { AppUser } from "./lib/auth";
import type { Project } from "../data/projects";

type ViewType = "home" | "studio" | "projects" | "athletes" | "workflows" | "queue" | "archive" | "settings";

const PAGE_TITLES: Record<ViewType, string> = {
  home: "Home",
  studio: "Studio",
  projects: "Campaigns",
  athletes: "Athletes",
  workflows: "Recipes",
  queue: "Queue",
  archive: "Archive",
  settings: "Settings",
};

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [isDark, setIsDark] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [activeRenders, setActiveRenders] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingPrefill, setPendingPrefill] = useState<{ workflowId?: string; athleteId?: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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

  // Restore session and subscribe to future auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) initStore(session.user.id, session.user.email ?? "");
      setAuthed(!!session);
      setAppUser(session?.user ? toAppUser(session.user) : null);
      if (session) setShowOnboarding(!isOnboarded());
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) initStore(session.user.id, session.user.email ?? "");
      setAuthed(!!session);
      setAppUser(session?.user ? toAppUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const tick = () => {
      const n = getQueue().filter(i => i.status === "rendering" || i.status === "queued").length;
      setActiveRenders(n);
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, []);

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

  const goToStudio = useCallback((opts?: { workflowId?: string; athleteId?: string; workspaceId?: string }) => {
    setPendingPrefill({ workflowId: opts?.workflowId, athleteId: opts?.athleteId });
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
    setExtraProjects(prev => [project, ...prev]);
    // Navigate to campaigns with the new project visible
    setCurrentView("projects");
    setShowNewCampaignModal(false);
  };

  const navItems = useMemo(() => [
    { view: "home" as const,      label: "Home",      icon: Home },
    { view: "projects" as const,  label: "Campaigns", icon: Folder },
    { view: "athletes" as const,  label: "Athletes",  icon: Users },
    { view: "workflows" as const, label: "Recipes",   icon: LayoutGrid },
  ], []);

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
      <div className={`h-14 flex items-center shrink-0 ${collapsed ? "justify-center" : "px-4 gap-2"}`}>
        <div className="size-2 rounded-full bg-accent shrink-0" />
        {!collapsed && <span className="text-sm font-semibold tracking-tight">Pluribus</span>}
      </div>

      {/* Search */}
      <div className={`${collapsed ? "px-1.5" : "px-2.5"} pb-2 shrink-0`}>
        <button
          onClick={() => { setPaletteOpen(true); setMobileSidebarOpen(false); }}
          title="Search"
          className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2 px-2.5"} h-8 rounded-md bg-card hover:bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors`}
        >
          <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
          {!collapsed && <><span className="text-sm flex-1 text-left">Search</span><kbd className="text-xs text-muted-foreground/70 border border-border rounded px-1 py-0.5">⌘K</kbd></>}
        </button>
      </div>

      {/* Nav */}
      <nav className={`${collapsed ? "px-1.5" : "px-2"} flex-1 flex flex-col gap-0.5 overflow-y-auto`} aria-label="Main">
        {navItems.map(item => renderNavItem(item.view, item.label, item.icon, undefined, collapsed))}
      </nav>

      {/* Footer */}
      <div className={`p-2 border-t border-border flex flex-col ${collapsed ? "items-center" : ""} gap-0.5 shrink-0`}>
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`hidden md:flex w-full items-center ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} h-8 rounded-md text-muted-foreground hover:bg-card hover:text-foreground transition-colors`}
        >
          <PanelLeft className={`size-4 shrink-0 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} strokeWidth={1.75} />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? "Light mode" : "Dark mode"}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} h-8 rounded-md text-muted-foreground hover:bg-card hover:text-foreground transition-colors`}
        >
          {isDark ? <Sun className="size-4 shrink-0" strokeWidth={1.75} /> : <Moon className="size-4 shrink-0" strokeWidth={1.75} />}
          {!collapsed && <span className="text-sm">{isDark ? "Light" : "Dark"}</span>}
        </button>
        <button
          onClick={() => navigateTo("settings")}
          title="Settings"
          className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} h-8 rounded-md transition-colors ${
            currentView === "settings" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
        >
          <SettingsIcon className="size-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="text-sm">Settings</span>}
        </button>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-2.5"} h-8 rounded-md text-muted-foreground hover:bg-card hover:text-red-400 transition-colors`}
        >
          <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="text-sm">Sign out</span>}
        </button>
        {!collapsed ? (
          <div className="mt-2 px-2.5 py-2 flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.avatarInitials ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex justify-center">
            <div className="size-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
              {user?.avatarInitials ?? "?"}
            </div>
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
          onComplete={(athleteId, workflowId) => {
            setOnboarded();
            setShowOnboarding(false);
            goToStudio({ athleteId, workflowId });
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
        className={`${sidebarCollapsed ? "w-14" : "w-[208px]"} border-r border-border bg-background flex-col shrink-0 hidden md:flex transition-[width] duration-200 ease-out overflow-hidden`}
      >
        {sidebarInner(sidebarCollapsed)}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="w-[208px] border-r border-border bg-background flex flex-col shrink-0 relative" onClick={e => e.stopPropagation()}>
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
        <header className="h-14 border-b border-border bg-background px-4 md:px-6 flex items-center justify-between shrink-0 gap-3">
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
            <button
              onClick={() => setCurrentView("queue")}
              title="Queue"
              className="relative h-8 w-8 rounded-md border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors hidden sm:flex items-center justify-center"
            >
              <Bell className="size-3.5" strokeWidth={1.75} />
              {activeRenders > 0 && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
            <button
              onClick={() => goToStudio()}
              className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">New render</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {currentView === "home" && (
            <Dashboard
              userName={user?.name ?? ""}
              onOpenCampaigns={() => setCurrentView("projects")}
              onNewCampaign={() => setShowNewCampaignModal(true)}
              onQuickGenerate={() => goToStudio()}
              onAddAthlete={() => setShowAddAthleteModal(true)}
              onAthleteClick={(id) => { if (id) setSelectedAthleteId(id); setCurrentView("athletes"); }}
              onAthleteGenerate={(id) => goToStudio({ athleteId: id })}
              onViewAllWorkflows={() => setCurrentView("workflows")}
              onWorkflowClick={(id) => goToStudio({ workflowId: id })}
            />
          )}
          {currentView === "projects" && (
            <Projects
              onLaunchStudio={(opts) => goToStudio(opts)}
              extraProjects={extraProjects}
            />
          )}
          {currentView === "athletes" && (
            <AthleteLibrary
              preSelectedAthleteId={selectedAthleteId}
              onAthleteDeselect={() => setSelectedAthleteId(null)}
              onGenerate={(id) => goToStudio({ athleteId: id })}
            />
          )}
          {currentView === "workflows" && (
            <WorkflowLibrary onSelectWorkflow={(id) => goToStudio({ workflowId: id })} />
          )}
          {currentView === "studio" && selectedWorkspace && (
            <Workspace
              workspaceId={selectedWorkspace}
              prefill={pendingPrefill ?? undefined}
              onBack={() => setCurrentView("home")}
            />
          )}
          {currentView === "queue" && <QueuePage />}
          {currentView === "archive" && <ArchivePage />}
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
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(v) => { setCurrentView(v); setPaletteOpen(false); }}
        onAthlete={(id) => { setSelectedAthleteId(id); setCurrentView("athletes"); setPaletteOpen(false); }}
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
    </div>
  );
}
