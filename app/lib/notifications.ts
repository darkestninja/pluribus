export interface Toast {
  id: string;
  title: string;
  body?: string;
  type: "success" | "info" | "warning" | "error";
  action?: { label: string; onClick: () => void };
  duration?: number;
}

const EV = "plb:toast";

export function toast(t: Omit<Toast, "id">): void {
  const full: Toast = { ...t, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  window.dispatchEvent(new CustomEvent(EV, { detail: full }));
}

export function onToast(cb: (t: Toast) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Toast>).detail);
  window.addEventListener(EV, handler);
  return () => window.removeEventListener(EV, handler);
}
