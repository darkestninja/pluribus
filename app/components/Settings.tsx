import { useState, useEffect } from "react";
import {
  User, Bell, Palette, CreditCard, Shield, HelpCircle, LogOut,
  Check, ChevronRight, Moon, Sun, Monitor, Zap, Mail, Lock,
  Globe, Download, Loader2, Eye, EyeOff, Users, Plus, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/notifications";
import type { AppUser } from "../lib/auth";

interface SettingsProps {
  appUser: AppUser | null;
  isDark: boolean;
  onThemeChange: (dark: boolean) => void;
  onSignOut: () => void;
  onClose: () => void;
}

type Tab = "account" | "appearance" | "notifications" | "billing" | "security" | "members" | "help";

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={enabled}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        enabled ? "bg-accent" : "bg-secondary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "account",       label: "Account",        icon: User },
  { id: "appearance",   label: "Appearance",      icon: Palette },
  { id: "notifications", label: "Notifications",  icon: Bell },
  { id: "billing",      label: "Billing & Credits", icon: CreditCard },
  { id: "security",     label: "Security",        icon: Shield },
  { id: "members",      label: "Members",         icon: Users },
  { id: "help",         label: "Help & Support",  icon: HelpCircle },
];

import { can, type UserRole } from "../lib/permissions";
import { getUserRole } from "../lib/store";

type WorkspaceMember = {
  id: string;
  email: string;
  role: UserRole;
  joinedAt: string;
  status: "active" | "invited";
};

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: "admin",          label: "Admin",           desc: "Full access — can manage members and settings" },
  { value: "editor",         label: "Editor",          desc: "Generate, review, and approve outputs" },
  { value: "viewer",         label: "Viewer",          desc: "View-only — cannot approve or export" },
  { value: "legal",          label: "Legal",           desc: "Can flag outputs; read-only otherwise" },
  { value: "subject_manager",label: "Subject Manager", desc: "Manages a subject's portal on their behalf" },
];

function MembersTab({ currentUserEmail }: { currentUserEmail: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>(() => [
    { id: "owner", email: currentUserEmail, role: "admin", joinedAt: new Date().toISOString(), status: "active" },
  ]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("editor");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!can(getUserRole(), "members:manage")) {
      toast({ type: "error", title: "Permission denied", body: "Only admins can invite members." }); return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (members.some(m => m.email === email)) {
      toast({ type: "error", title: "Already a member", body: email }); return;
    }
    setInviting(true);
    await new Promise(r => setTimeout(r, 600)); // stub — replace with API call
    setMembers(prev => [...prev, {
      id: crypto.randomUUID().slice(0, 8),
      email,
      role: inviteRole,
      joinedAt: new Date().toISOString(),
      status: "invited",
    }]);
    toast({ type: "success", title: "Invite sent", body: `${email} invited as ${inviteRole}` });
    setInviteEmail("");
    setInviting(false);
  };

  const handleRoleChange = (id: string, role: UserRole) => {
    if (!can(getUserRole(), "members:manage")) {
      toast({ type: "error", title: "Permission denied", body: "Only admins can change member roles." }); return;
    }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    toast({ type: "info", title: "Role updated" });
  };

  const handleRemove = (id: string) => {
    if (!can(getUserRole(), "members:manage")) {
      toast({ type: "error", title: "Permission denied", body: "Only admins can remove members." }); return;
    }
    setMembers(prev => prev.filter(m => m.id !== id));
    toast({ type: "info", title: "Member removed" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">Workspace members</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Manage who has access to this workspace and their roles.</p>
      </div>

      {/* Invite form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-medium text-foreground">Invite a member</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
            placeholder="colleague@example.com"
            className="flex-1 h-9 bg-background border border-border rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as UserRole)}
            className="h-9 pl-2.5 pr-7 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-accent appearance-none cursor-pointer"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="h-9 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {inviting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Invite
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          They will receive an email invitation. Pending invites expire after 7 days.
        </p>
      </div>

      {/* Role descriptions */}
      <details className="rounded-lg border border-border bg-card overflow-hidden">
        <summary className="px-4 py-2.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-2">
          Role reference
        </summary>
        <div className="divide-y divide-border">
          {ROLE_OPTIONS.map(r => (
            <div key={r.value} className="px-4 py-2.5">
              <p className="text-xs font-medium">{r.label}</p>
              <p className="text-[11px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
      </details>

      {/* Member list */}
      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {members.map(member => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/30 transition-colors">
            <div className="size-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
              {member.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{member.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {member.status === "invited" && (
                  <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded px-1">Pending invite</span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  {member.status === "active" ? "Joined" : "Invited"} {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            {member.email === currentUserEmail ? (
              <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-secondary">You · Admin</span>
            ) : (
              <div className="flex items-center gap-1.5">
                <select
                  value={member.role}
                  onChange={e => handleRoleChange(member.id, e.target.value as UserRole)}
                  className="h-7 pl-2 pr-6 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:border-accent appearance-none cursor-pointer"
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleRemove(member.id)}
                  title="Remove member"
                  className="size-7 rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/40 transition-colors flex items-center justify-center"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Settings({ appUser, isDark, onThemeChange, onSignOut, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // ── Account ──────────────────────────────────────────────────────────────
  const nameParts = (appUser?.name ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] ?? "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
  const [savingProfile, setSavingProfile] = useState(false);

  const [autoSave, setAutoSave] = useState(() => {
    try { return localStorage.getItem("plb_autosave") !== "false"; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem("plb_autosave", String(autoSave)); } catch {}
  }, [autoSave]);

  const saveProfile = async () => {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!fullName) { toast({ type: "error", title: "Name cannot be empty." }); return; }
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
    setSavingProfile(false);
    if (error) {
      toast({ type: "error", title: "Failed to save profile.", body: error.message });
    } else {
      toast({ type: "success", title: "Profile updated." });
    }
  };

  // ── Appearance ───────────────────────────────────────────────────────────
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(() => {
    try { return (localStorage.getItem("plb_theme_mode") as "light" | "dark" | "system") ?? (isDark ? "dark" : "light"); }
    catch { return isDark ? "dark" : "light"; }
  });

  const applyTheme = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    try { localStorage.setItem("plb_theme_mode", mode); } catch {}
    if (mode === "system") {
      onThemeChange(window.matchMedia("(prefers-color-scheme: dark)").matches);
    } else {
      onThemeChange(mode === "dark");
    }
  };

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("plb_notifs");
      return raw ? JSON.parse(raw) : { email: true, renders: true, credits: true, projects: false };
    } catch {
      return { email: true, renders: true, credits: true, projects: false };
    }
  });

  const toggleNotif = (key: string) => {
    setNotifs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem("plb_notifs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // ── Security / password change ───────────────────────────────────────────
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setPwError("Passwords don't match."); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    if (error) {
      setPwError(error.message);
    } else {
      toast({ type: "success", title: "Password updated successfully." });
      setShowChangePw(false);
      setNewPw(""); setConfirmPw(""); setShowNewPw(false);
    }
  };

  const downloadData = () => {
    const data: Record<string, unknown> = { user: appUser, note: "Full data export available via Supabase dashboard." };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "pluribus-data.json"; a.click(); URL.revokeObjectURL(a.href);
    toast({ type: "success", title: "Data exported." });
  };

  // Credits stub (replace with real Supabase query later)
  const credits = 248;
  const maxCredits = 1000;

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold tracking-tight">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your preferences</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeTab === id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-border shrink-0">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-muted-foreground hover:bg-secondary/50 hover:text-red-400 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="size-3.5 shrink-0" strokeWidth={1.75} />
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-8">

          {/* ── Account ── */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your profile and preferences</p>
              </div>

              {/* Profile */}
              <section className="space-y-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Profile</h4>

                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-full bg-accent/20 text-accent flex items-center justify-center text-lg font-semibold shrink-0">
                    {appUser?.avatarInitials ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{appUser?.name ?? "User"}</p>
                    <p className="text-xs text-muted-foreground">{appUser?.email ?? ""}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Email address</label>
                  <input
                    type="email"
                    value={appUser?.email ?? ""}
                    readOnly
                    className="w-full h-9 px-3 bg-secondary border border-border rounded-md text-sm text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground/60">Email cannot be changed here. Contact support if needed.</p>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Save profile
                </button>
              </section>

              {/* Preferences */}
              <section className="space-y-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preferences</h4>

                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Zap className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <div>
                        <p className="text-sm font-medium">Auto-save projects</p>
                        <p className="text-xs text-muted-foreground">Save changes automatically as you work</p>
                      </div>
                    </div>
                    <Toggle enabled={autoSave} onToggle={() => setAutoSave(v => !v)} />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Globe className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <div>
                        <p className="text-sm font-medium">Language</p>
                        <p className="text-xs text-muted-foreground">Interface language</p>
                      </div>
                    </div>
                    <select className="h-8 px-2.5 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors">
                      <option>English (US)</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>German</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── Appearance ── */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Appearance</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Customise how Pluribus looks</p>
              </div>

              <section className="space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</h4>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: "light",  label: "Light",  icon: Sun },
                    { id: "dark",   label: "Dark",   icon: Moon },
                    { id: "system", label: "System", icon: Monitor },
                  ] as const).map(({ id, label, icon: Icon }) => {
                    const active = themeMode === id;
                    return (
                      <button
                        key={id}
                        onClick={() => applyTheme(id)}
                        className={`flex flex-col items-center gap-2.5 p-4 rounded-lg border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          active
                            ? "border-accent bg-accent/5"
                            : "border-border bg-card hover:border-border/70 hover:bg-secondary/50"
                        }`}
                      >
                        <Icon className={`size-5 ${active ? "text-accent" : "text-muted-foreground"}`} strokeWidth={1.75} />
                        <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                        {active && (
                          <span className="flex items-center gap-1 text-xs text-accent">
                            <Check className="size-3" strokeWidth={2} /> Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Notifications</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Choose what you want to be notified about</p>
              </div>

              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {[
                  { key: "email",   icon: Mail,  label: "Email notifications",  desc: "Receive updates and digests by email" },
                  { key: "renders", icon: Zap,   label: "Render complete",       desc: "Notify when generations finish" },
                  { key: "credits", icon: CreditCard, label: "Credit alerts",   desc: "Alert when your credits are running low" },
                  { key: "projects",icon: User,  label: "Project updates",       desc: "Team collaboration notifications" },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Icon className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    <Toggle enabled={!!notifs[key]} onToggle={() => toggleNotif(key)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Billing ── */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Billing & Credits</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your subscription and usage</p>
              </div>

              {/* Plan card */}
              <section className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Pro Plan</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Unlimited athletes · 1,000 credits / month</p>
                  </div>
                  <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">Active</span>
                </div>
                <div className="px-4 py-3 flex items-end gap-1.5">
                  <span className="text-3xl font-bold">$49</span>
                  <span className="text-sm text-muted-foreground pb-0.5">/ month</span>
                </div>
                <div className="px-4 pb-4">
                  <button
                    onClick={() => toast({ type: "info", title: "Billing portal coming soon.", body: "Stripe integration is on the roadmap." })}
                    className="w-full h-9 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                  >
                    Manage plan
                  </button>
                </div>
              </section>

              {/* Credits */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</h4>
                  <p className="text-xs text-muted-foreground">Resets in 12 days</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Remaining</span>
                    <span className="text-sm font-semibold tabular-nums">{credits.toLocaleString()} / {maxCredits.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(credits / maxCredits) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{maxCredits - credits} credits used this cycle</p>
                </div>
                <button
                  onClick={() => toast({ type: "info", title: "Credit top-ups coming soon.", body: "Stripe integration is on the roadmap." })}
                  className="w-full h-9 rounded-md border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Purchase additional credits
                </button>
              </section>
            </div>
          )}

          {/* ── Security ── */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Security</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage your account security settings</p>
              </div>

              <div className="space-y-3">
                {/* Change password row */}
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setShowChangePw(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                      <div>
                        <p className="text-sm font-medium">Change password</p>
                        <p className="text-xs text-muted-foreground">Update your account password</p>
                      </div>
                    </div>
                    <ChevronRight className={`size-4 text-muted-foreground transition-transform ${showChangePw ? "rotate-90" : ""}`} strokeWidth={1.75} />
                  </button>

                  {showChangePw && (
                    <form onSubmit={changePassword} className="px-4 pb-4 space-y-3 border-t border-border pt-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">New password</label>
                        <div className="relative">
                          <input
                            type={showNewPw ? "text" : "password"}
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            placeholder="Min. 8 characters"
                            autoComplete="new-password"
                            className="w-full h-9 pl-3 pr-9 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPw(v => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPw ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Confirm new password</label>
                        <input
                          type="password"
                          value={confirmPw}
                          onChange={e => setConfirmPw(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                        />
                      </div>
                      {pwError && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">{pwError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={changingPw}
                          className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          {changingPw ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          Update password
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowChangePw(false); setNewPw(""); setConfirmPw(""); setPwError(null); }}
                          className="h-9 px-4 rounded-md border border-border bg-card hover:bg-secondary text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* TFA */}
                <button
                  onClick={() => toast({ type: "info", title: "Two-factor authentication coming soon." })}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-medium">Two-factor authentication</p>
                      <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">Not enabled</span>
                </button>

                {/* Download data */}
                <button
                  onClick={downloadData}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Download className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-medium">Download your data</p>
                      <p className="text-xs text-muted-foreground">Export all your projects and assets as JSON</p>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}

          {/* ── Help ── */}
          {activeTab === "members" && <MembersTab currentUserEmail={appUser?.email ?? ""} />}

          {activeTab === "help" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Help & Support</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Get help and learn about Pluribus</p>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                {[
                  { label: "Documentation",    desc: "Learn how to use Pluribus" },
                  { label: "Video tutorials",  desc: "Watch step-by-step guides" },
                  { label: "Community forum",  desc: "Connect with other users" },
                  { label: "Contact support",  desc: "Get help from our team" },
                  { label: "Feature requests", desc: "Suggest new features" },
                ].map(({ label, desc }) => (
                  <button
                    key={label}
                    onClick={() => toast({ type: "info", title: `${label} coming soon.` })}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card px-4 py-3 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Pluribus · Version 1.0.0</p>
                <p className="text-xs text-muted-foreground/60">© 2026 Pluribus AI. All rights reserved.</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
