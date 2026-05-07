import { useState, useRef } from "react";
import { X, Upload, User } from "lucide-react";
import { addAthlete } from "../lib/store";
import type { Athlete } from "../../data/athletes";
import { toast } from "../lib/notifications";
import { compressToDataUrl } from "../lib/imageUtils";

interface AddAthleteModalProps {
  onClose: () => void;
  onAdded?: (athlete: Athlete) => void;
}

const SPORTS = ["Swimming", "Track", "Weightlifting"] as const;

const EVENTS: Record<string, string[]> = {
  Swimming: ["100m Freestyle", "200m Freestyle", "100m Backstroke", "100m Butterfly", "200m IM"],
  Track: ["100m Sprint", "200m Sprint", "400m", "110m Hurdles", "Long Jump"],
  Weightlifting: ["Clean & Jerk", "Snatch", "Total"],
};

export function AddAthleteModal({ onClose, onAdded }: AddAthleteModalProps) {
  const [name, setName] = useState("");
  const [sport, setSport] = useState<typeof SPORTS[number]>("Swimming");
  const [event, setEvent] = useState(EVENTS.Swimming[0]);
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressToDataUrl(file).then(setPreviewUrl);
  };

  const handleSportChange = (s: typeof SPORTS[number]) => {
    setSport(s);
    setEvent(EVENTS[s][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = `athlete-${Date.now()}`;
    const newAthlete: Athlete = {
      id,
      name: name.trim(),
      sport,
      event,
      status: "pending",
      image: previewUrl ?? "/athletes/placeholder.jpg",
      captureDate: null,
      country: country.trim() || undefined,
      age: age ? parseInt(age) : undefined,
    };

    addAthlete(newAthlete);
    toast({
      type: "success",
      title: "Athlete added",
      body: `${newAthlete.name} has been added to your roster. Upload reference photos to complete their profile.`,
    });
    onAdded?.(newAthlete);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-popover border border-border rounded-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Add athlete</h2>
          <button onClick={onClose} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex flex-col flex-1">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="size-20 rounded-xl border-2 border-dashed border-border hover:border-accent/60 flex flex-col items-center justify-center gap-1.5 transition-colors overflow-hidden shrink-0 relative group"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <User className="size-7 text-muted-foreground/40" strokeWidth={1} />
                  <span className="text-[10px] text-muted-foreground/60">Upload</span>
                </>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="size-4 text-white" strokeWidth={1.75} />
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground">Full name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Athlete's full name"
                required
                autoFocus
                className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Sport */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Sport</label>
            <div className="flex gap-1.5">
              {SPORTS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSportChange(s)}
                  className={`flex-1 h-8 rounded-md text-xs font-medium transition-colors ${sport === s ? "bg-accent text-accent-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-accent/40"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Event */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Event</label>
            <select
              value={event}
              onChange={e => setEvent(e.target.value)}
              className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent"
            >
              {EVENTS[sport].map(ev => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>

          {/* Country + Age row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Country</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="e.g. Australia"
                className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Age</label>
              <input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="e.g. 28"
                min={16}
                max={60}
                className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 bg-card border border-border rounded-lg px-3 py-2.5">
            After adding, upload reference photos from the Athlete profile to enable AI generation.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors"
            >
              Add athlete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
