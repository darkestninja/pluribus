import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { signIn, signUp, resetPassword } from "../lib/auth";

interface AuthScreenProps {
  onAuth: () => void;
}

type Mode = "login" | "signup" | "forgot";

const STATS = [
  { value: "4.2M+", label: "Images generated" },
  { value: "98%",   label: "Identity fidelity" },
  { value: "60×",   label: "Faster than shoots" },
];

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [mode]);

  const reset = (next: Mode) => {
    setMode(next);
    setError(null);
    setLoading(false);
    setForgotSent(false);
    setShowPw(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "forgot") {
      setLoading(true);
      await resetPassword(email);
      setLoading(false);
      setForgotSent(true);
      return;
    }

    if (mode === "signup" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const result = await (mode === "login"
      ? signIn(email, password)
      : signUp(name, email, password));
    setLoading(false);

    if (!result.ok) setError(result.error!);
    else onAuth();
  };

  const useDemoAccount = async () => {
    setLoading(true);
    const result = await signIn("daniel@pluribus.ai", "demo123");
    setLoading(false);
    if (result.ok) onAuth();
    else setError(result.error ?? "Demo login failed.");
  };

  return (
    <div className="fixed inset-0 bg-background text-foreground flex overflow-hidden">

      {/* ── Left panel — brand ──────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[480px] xl:w-[520px] shrink-0 bg-card border-r border-border flex-col justify-between p-12 relative overflow-hidden">

        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 60% at 30% 70%, rgba(0,153,255,0.07) 0%, transparent 70%)",
        }} />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

        {/* Top: logo */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="size-2 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-tight">Pluribus</span>
        </div>

        {/* Middle: headline */}
        <div className="relative z-10 space-y-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">
            AI Sports Content Platform
          </p>
          <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight">
            Athlete imagery<br />at the speed<br />of sport.
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
            Generate professional sports content for campaigns, press, and editorial — in minutes, not months.
          </p>
        </div>

        {/* Bottom: stats */}
        <div className="relative z-10 flex gap-8 pt-6 border-t border-border">
          {STATS.map(s => (
            <div key={s.label}>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto relative">

        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10 self-start relative z-10">
          <div className="size-2 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-tight">Pluribus</span>
        </div>

        <div className="w-full max-w-[380px] relative z-10">

          {/* ── Forgot password sent ── */}
          {mode === "forgot" && forgotSent ? (
            <div className="space-y-5">
              <div className="size-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="size-5 text-emerald-500" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Check your email</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  If an account exists for <span className="text-foreground font-medium">{email}</span>, you'll receive a reset link shortly.
                </p>
              </div>
              <button
                onClick={() => reset("login")}
                className="w-full h-10 rounded-lg border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </div>

          ) : mode === "forgot" ? (
            /* ── Forgot password form ── */
            <div className="space-y-6">
              <div>
                <button
                  onClick={() => reset("login")}
                  className="text-xs text-muted-foreground hover:text-foreground mb-5 flex items-center gap-1 transition-colors"
                >
                  ← Back to sign in
                </button>
                <h2 className="text-xl font-semibold tracking-tight">Reset your password</h2>
                <p className="text-sm text-muted-foreground mt-1.5">We'll send a reset link to your inbox.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email">
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={INPUT}
                  />
                </Field>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <PrimaryButton loading={loading}>Send reset link</PrimaryButton>
              </form>
            </div>

          ) : (
            /* ── Login / Signup ── */
            <div className="space-y-6">

              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {mode === "login" ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {mode === "login"
                    ? "Sign in to your Pluribus account."
                    : "Create your account — free to try."}
                </p>
              </div>

              {/* Mode tabs */}
              <div className="flex bg-secondary rounded-lg p-0.5">
                <TabButton active={mode === "login"} onClick={() => reset("login")}>Sign in</TabButton>
                <TabButton active={mode === "signup"} onClick={() => reset("signup")}>Create account</TabButton>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <Field label="Full name">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      autoComplete="name"
                      className={INPUT}
                    />
                  </Field>
                )}

                <Field label="Email">
                  <input
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className={INPUT}
                  />
                </Field>

                <Field
                  label="Password"
                  action={mode === "login" ? (
                    <button type="button" onClick={() => reset("forgot")} className="text-xs text-accent hover:text-accent/80 transition-colors">
                      Forgot password?
                    </button>
                  ) : undefined}
                >
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className={`${INPUT} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPw
                        ? <EyeOff className="size-3.5" strokeWidth={1.75} />
                        : <Eye className="size-3.5" strokeWidth={1.75} />}
                    </button>
                  </div>
                </Field>

                {mode === "signup" && (
                  <Field label="Confirm password">
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className={INPUT}
                    />
                  </Field>
                )}

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <PrimaryButton loading={loading}>
                  {mode === "login" ? "Sign in" : "Create account"}
                  {!loading && <ArrowRight className="size-3.5" strokeWidth={2} />}
                </PrimaryButton>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  type="button"
                  onClick={useDemoAccount}
                  disabled={loading}
                  className="w-full h-10 rounded-lg border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Continue with demo account
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-[11px] text-muted-foreground/50 z-10">
          © {new Date().getFullYear()} Pluribus AI
        </p>
      </div>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

const INPUT = "w-full h-10 px-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 placeholder:text-muted-foreground/40 transition-all";

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function PrimaryButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-8 rounded-md text-sm font-medium transition-all ${
        active
          ? "bg-card text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-500/8 border border-red-500/20 rounded-lg">
      <div className="size-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
      <p className="text-xs text-red-400 leading-relaxed">{children}</p>
    </div>
  );
}
