import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowRight, Home, Folder, Users, LayoutGrid, Activity, Archive, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { getAthletes } from "../lib/store";

type ViewType = "home" | "studio" | "projects" | "athletes" | "workflows" | "queue" | "archive" | "settings";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
  onAthlete: (id: string) => void;
  onGenerate: (id: string) => void;
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  action: () => void;
  group: "Navigate" | "Athletes" | "Generate";
}

export function CommandPalette({ open, onClose, onNavigate, onAthlete, onGenerate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: Item[] = useMemo(() => {
    const navs: Item[] = [
      { id: "nav:home",      label: "Home",      icon: Home,        action: () => onNavigate("home"),      group: "Navigate" },
      { id: "nav:projects",  label: "Projects",  icon: Folder,      action: () => onNavigate("projects"),  group: "Navigate" },
      { id: "nav:athletes",  label: "Athletes",  icon: Users,       action: () => onNavigate("athletes"),  group: "Navigate" },
      { id: "nav:workflows", label: "Workflows", icon: LayoutGrid,  action: () => onNavigate("workflows"), group: "Navigate" },
      { id: "nav:queue",     label: "Queue",     icon: Activity,    action: () => onNavigate("queue"),     group: "Navigate" },
      { id: "nav:archive",   label: "Archive",   icon: Archive,     action: () => onNavigate("archive"),   group: "Navigate" },
      { id: "nav:settings",  label: "Settings",  icon: SettingsIcon,action: () => onNavigate("settings"),  group: "Navigate" },
    ];
    const ath = getAthletes();
    const athleteOpen: Item[] = ath.map(a => ({
      id: `ath:${a.id}`,
      label: a.name,
      hint: `${a.sport} · ${a.event}`,
      icon: Users,
      action: () => onAthlete(a.id),
      group: "Athletes",
    }));
    const athleteGen: Item[] = ath.map(a => ({
      id: `gen:${a.id}`,
      label: `Generate with ${a.name}`,
      hint: a.sport,
      icon: Sparkles,
      action: () => onGenerate(a.id),
      group: "Generate",
    }));
    return [...navs, ...athleteOpen, ...athleteGen];
  }, [onNavigate, onAthlete, onGenerate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      i.hint?.toLowerCase().includes(q) ||
      i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); filtered[active]?.action(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active]);

  if (!open) return null;

  // Group by section
  const groups = filtered.reduce<Record<string, Item[]>>((acc, i) => {
    (acc[i.group] ||= []).push(i);
    return acc;
  }, {});

  let runningIdx = -1;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[18vh] px-4">
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Search className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No matches</div>
          )}
          {Object.entries(groups).map(([group, list]) => (
            <div key={group} className="mb-1">
              <div className="px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-muted-foreground">{group}</div>
              {list.map((item) => {
                runningIdx++;
                const isActive = runningIdx === active;
                const i = runningIdx;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 h-9 transition-colors text-left ${
                      isActive ? "bg-secondary" : "hover:bg-card"
                    }`}
                  >
                    <Icon className="size-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                    <span className="text-sm flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="text-xs text-muted-foreground truncate">{item.hint}</span>}
                    <ArrowRight className={`size-3.5 ${isActive ? "text-foreground" : "text-muted-foreground/0"}`} strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
