import { useState } from "react";
import { X, Check } from "lucide-react";
import { workflowTemplates } from "../../data/workflows";
import { Project } from "../../data/projects";
import { getAthletes } from "../lib/store";

export const CAMPAIGN_TEMPLATES = [
  { id: "olympic",  name: "Olympic announcement",  workflowId: "wf-noir-studio",     brief: "Official announcement portraiture for national committee media" },
  { id: "season",   name: "Season opener",          workflowId: "wf-daylight-action", brief: "Action editorial for season preview content" },
  { id: "victory",  name: "Victory celebration",    workflowId: "wf-victory-podium",  brief: "Podium and celebration imagery for event coverage" },
  { id: "social",   name: "Social editorial",        workflowId: "wf-noir-studio",    brief: "Vertical editorial for social channels" },
  { id: "signing",  name: "Contract signing",        workflowId: "wf-victory-podium", brief: "Professional portraits for partnership announcements" },
  { id: "blank",    name: "Start blank",             workflowId: "",                   brief: "" },
];

interface NewCampaignModalProps {
  onClose: () => void;
  onCreate: (project: Project) => void;
}

export function NewCampaignModal({ onClose, onCreate }: NewCampaignModalProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [workflowId, setWorkflowId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const close = () => {
    setName(""); setDesc(""); setAthleteIds([]); setWorkflowId(""); setSelectedTemplate(null);
    onClose();
  };

  const athletes = getAthletes();

  const handleCreate = () => {
    if (!name.trim()) return;
    const thumbAthlete = athleteIds.length ? athletes.find(a => a.id === athleteIds[0]) : null;
    const proj: Project = {
      id: `project-${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || undefined,
      thumbnail: thumbAthlete?.image ?? "/projects/james-magnussen.jpg",
      lastEdited: "just now",
      type: "active",
      athleteIds: athleteIds.length ? athleteIds : undefined,
      workflowId: workflowId || undefined,
      status: "In Progress",
      assetCount: 0,
    };
    onCreate(proj);
    close();
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-popover border border-border rounded-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border shrink-0">
          <h2 className="text-base font-semibold">New campaign</h2>
          <button onClick={close} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Templates */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Template</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CAMPAIGN_TEMPLATES.map(tmpl => {
                const sel = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedTemplate(tmpl.id);
                      if (tmpl.id !== "blank") {
                        setName(tmpl.name);
                        setDesc(tmpl.brief);
                        setWorkflowId(tmpl.workflowId);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${sel ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}
                  >
                    <p className="text-xs font-medium truncate">{tmpl.name}</p>
                    {tmpl.brief && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{tmpl.brief}</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Campaign name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Olympic announcement portraits"
              className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Brief */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Brief</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Describe the campaign goal…"
              rows={2}
              className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Athletes */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Athletes</label>
            {athletes.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-card border border-border rounded-md px-3 py-2.5">No athletes yet — add some from the Athletes page first.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                {athletes.map(a => {
                  const sel = athleteIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAthleteIds(prev => sel ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${sel ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}
                    >
                      <img src={a.image} alt={a.name} className="size-8 rounded-full object-cover" />
                      <span className="text-xs truncate w-full text-center">{a.name.split(" ")[0]}</span>
                      {sel && (
                        <div className="absolute top-1 right-1 size-4 rounded-full bg-accent flex items-center justify-center">
                          <Check className="size-2.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Style template</label>
            <div className="space-y-1.5">
              {workflowTemplates.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => setWorkflowId(wf.id === workflowId ? "" : wf.id)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${workflowId === wf.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}
                >
                  <div className="size-10 rounded-md overflow-hidden shrink-0">
                    <img src={wf.thumbnail} alt={wf.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{wf.name}</p>
                    {wf.description && <p className="text-xs text-muted-foreground truncate">{wf.description}</p>}
                  </div>
                  {workflowId === wf.id && <Check className="size-3.5 text-accent shrink-0" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 shrink-0">
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors"
          >
            Create campaign
          </button>
          <button
            onClick={close}
            className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
