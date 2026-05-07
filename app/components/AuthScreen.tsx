import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { signIn, signUp, resetPassword } from "../lib/auth";

interface AuthScreenProps {
  onAuth: () => void;
}

type Mode = "login" | "signup" | "forgot";

const FEATURES = [
  "AI-powered athlete portrait generation",
  "Multi-athlete campaign management",
  "Likeness quality scoring",
  "Batch generation & client review",
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

    if (!result.ok) {
      setError(result.error!);
    } else {
      onAuth();
    }
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
      {/* Left panel — brand */}
      <div className="hidden lg:flex w-[480px] shrink-0 bg-card border-r border-border flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #0099FF 0%, transparent 60%), radial-gradient(circle at 80% 20%, #0099FF 0%, transparent 50%)",
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-16">
            <div className="size-2.5 rounded-full bg-accent" />
            <span className="text-sm font-semibold tracking-tight">Pluribus</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight leading-tight mb-4">
            AI-powered sports<br />
            content at scale.
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10">
            Generate professional athlete imagery for campaigns,
            announcements, and editorial — in minutes, not days.
          </p>

          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="size-4 text-accent shrink-0" strokeWidth={2} />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex gap-2">
          {[
            "/athletes/james-magnussen.jpg",
            "/athletes/marvin-bracy.jpg",
            "/athletes/megan-romano.jpg",
          ].map((src, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden flex-1 aspect-[3/4]"
              style={{ opacity: 0.4 + i * 0.2 }}
            >
              <img src={src} alt="" className="w-full h-full object-cover grayscale" />
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-10 self-start">
          <div className="size-2.5 rounded-full bg-accent" />
          <span className="text-sm font-semibold tracking-tight">Pluribus</span>
        </div>

        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            {mode === "login" && (
              <>
                <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue.</p>
              </>
            )}
            {mode === "signup" && (
              <>
                <h2 className="text-xl font-semibold tracking-tight">Create an account</h2>
                <p className="text-sm text-muted-foreground mt-1">Get started with Pluribus today.</p>
              </>
            )}
            {mode === "forgot" && (
              <>
                <h2 className="text-xl font-semibold tracking-tight">Reset password</h2>
                <p className="text-sm text-muted-foreground mt-1">We'll send you a reset link.</p>
              </>
            )}
          </div>

          {forgotSent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-400">
                  If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
                </p>
              </div>
              <button
                onClick={() => reset("login")}
                className="w-full h-9 rounded-md border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Password</label>
                    {mode === "login" && (
                      <button type="button" onClick={() => reset("forgot")} className="text-xs text-accent hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      className="w-full h-9 pl-3 pr-9 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="size-3.5" strokeWidth={1.75} /> : <Eye className="size-3.5" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    {mode === "login" && "Sign in"}
                    {mode === "signup" && "Create account"}
                    {mode === "forgot" && "Send reset link"}
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </>
                )}
              </button>

              {mode !== "signup" && (
                <button
                  type="button"
                  onClick={useDemoAccount}
                  disabled={loading}
                  className="w-full h-9 rounded-md border border-border bg-transparent hover:bg-card text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Continue with demo account
                </button>
              )}

              <p className="text-center text-xs text-muted-foreground pt-1">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button type="button" onClick={() => reset("signup")} className="text-accent hover:underline font-medium">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => reset("login")} className="text-accent hover:underline font-medium">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
