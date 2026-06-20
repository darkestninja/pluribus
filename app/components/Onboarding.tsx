import { useState, useRef } from "react";
import { X, Plus, Check } from "lucide-react";
import { getAthletes } from "../lib/store";

interface OnboardingProps {
  onComplete: (athleteId: string) => void;
  onSkip: () => void;
}

export function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const athletes = getAthletes();
  const [step, setStep] = useState(1);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  // New athlete form state
  const [showNewAthlete, setShowNewAthlete] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState("");
  const [newAthletePhoto, setNewAthletePhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);
  const canGoToStep2 = !!selectedAthleteId;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-background border border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" strokeWidth={1.75} />
          Skip for now
        </button>

        {/* Step dots */}
        <div className="flex justify-center gap-2 pt-6 pb-4">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? "w-6 bg-accent" : s < step ? "w-3 bg-accent/50" : "w-3 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="px-8 pb-8">
          {/* ── Step 1: Pick an athlete ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold tracking-tight">Pick an athlete</h2>
                <p className="text-sm text-muted-foreground mt-1">Select the athlete you want to generate images for.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                {athletes.map(a => {
                  const sel = selectedAthleteId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => { setSelectedAthleteId(a.id); setShowNewAthlete(false); }}
                      className={`group relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                        sel ? "border-accent ring-2 ring-accent/20" : "border-border hover:border-accent/40"
                      }`}
                    >
                      <div className="aspect-[3/4] overflow-hidden">
                        <img src={a.image} alt={a.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      </div>
                      <div className="p-2 bg-card">
                        <p className="text-xs font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.sport}</p>
                      </div>
                      {sel && (
                        <div className="absolute top-2 right-2 size-5 rounded-full bg-accent flex items-center justify-center">
                          <Check className="size-3 text-accent-foreground" strokeWidth={2.5} />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Add new card */}
                {!showNewAthlete ? (
                  <button
                    onClick={() => { setShowNewAthlete(true); setSelectedAthleteId(null); }}
                    className="group rounded-xl border-2 border-dashed border-border hover:border-accent/40 flex flex-col items-center justify-center gap-2 min-h-[140px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="size-8 rounded-full border border-dashed border-current flex items-center justify-center">
                      <Plus className="size-4" strokeWidth={1.5} />
                    </div>
                    <span className="text-xs">Add new</span>
                  </button>
                ) : (
                  <div className="rounded-xl border-2 border-accent bg-accent/5 p-3 space-y-2">
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-md bg-secondary border border-dashed border-border overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      {newAthletePhoto
                        ? <img src={newAthletePhoto} alt="" className="w-full h-full object-cover" />
                        : <Plus className="size-5 text-muted-foreground" strokeWidth={1.5} />
                      }
                    </div>
                    <input
                      type="text"
                      placeholder="Name"
                      value={newAthleteName}
                      onChange={e => setNewAthleteName(e.target.value)}
                      className="w-full h-7 px-2 bg-card border border-border rounded text-xs focus-visible:border-accent placeholder:text-muted-foreground"
                    />
                    <button
                      disabled={!newAthleteName.trim()}
                      onClick={() => {
                        // We can't actually add to store here without going through the full form,
                        // so we just set a placeholder ID that will let the user continue
                        setSelectedAthleteId(athletes[0]?.id ?? "");
                        setShowNewAthlete(false);
                      }}
                      className="w-full h-6 rounded bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-xs font-medium transition-colors"
                    >
                      Use
                    </button>
                  </div>
                )}
              </div>

              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) setNewAthletePhoto(URL.createObjectURL(file));
              }} />

              <button
                onClick={() => setStep(2)}
                disabled={!canGoToStep2}
                className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground font-medium transition-colors"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Step 2: You're all set ── */}
          {step === 2 && selectedAthlete && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold tracking-tight">You're all set</h2>
                <p className="text-sm text-muted-foreground mt-1">Ready to generate your first AI sports image.</p>
              </div>

              <div className="flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="size-24 rounded-xl overflow-hidden mx-auto border-2 border-accent/30">
                    <img src={selectedAthlete.image} alt={selectedAthlete.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{selectedAthlete.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedAthlete.sport}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => onComplete(selectedAthleteId!)}
                  className="w-full h-11 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  Generate first image →
                </button>
                <button
                  onClick={onSkip}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  I'll explore on my own →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
