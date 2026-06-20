import { useState, useRef, useEffect } from "react";
import { Mic, AudioWaveform, X, Pin, RefreshCw, ChevronLeft, Star } from "lucide-react";
import { getAthletes, useStoreSync } from "../lib/store";
import type { Athlete } from "../../data/athletes";

interface Message {
  id: string;
  role: "user" | "persona";
  text: string;
}

interface PersonaConversation {
  personaId: string;
  messages: Message[];
}

const SUGGESTED_QUESTIONS = [
  "What are you up to?",
  "What would change your mind?",
  "What would your next option be?",
  "Why did you choose this?",
  "Tell me more about that.",
];

const DEMO_PERSONAS = [
  { id: "demo-1", name: "Mikel Martins",   role: "CEO",             industry: "Technology",          response: "Summer", comment: "It mirrors how I think about work and projects — pushing forward, building something new. It's a season that's all about progress, you know?", gender: "Male", ageRange: "Millennial", location: "Palo Alto, United States", experience: "20 Yrs", image: null },
  { id: "demo-2", name: "Head of Brand",   role: "Head of Brand",   industry: "DTC Telehealth",      response: "Spring", comment: "There's a freshness to spring that feels optimistic. New beginnings match where we are as a company.",                                    gender: "Female", ageRange: "Gen X",       location: "New York, United States",  experience: "15 Yrs", image: null },
  { id: "demo-3", name: "Emily Chen",      role: "CFO",             industry: "Financial Services",  response: "Autumn", comment: "Autumn is measured, considered. I make the best decisions when there's a chill in the air.",                                           gender: "Female", ageRange: "Millennial", location: "San Francisco, United States", experience: "18 Yrs", image: null },
  { id: "demo-4", name: "Focus Group",     role: "Group",           industry: "Venture Capital",     response: "Summer", comment: "Consensus from the group was summer — high energy, long days, more opportunity.",                                                     gender: "Mixed",  ageRange: "Mixed",      location: "Various",                  experience: "—",      image: null },
  { id: "demo-5", name: "James Smith",     role: "Head Teacher",    industry: "Higher Education",    response: "Spring", comment: "Spring is when students are most engaged. The academic year peaks in spring.",                                                        gender: "Male",   ageRange: "Boomer",     location: "London, United Kingdom",   experience: "30 Yrs", image: null },
  { id: "demo-6", name: "Alice Johnson",   role: "Product Manager", industry: "Technology",          response: "Winter", comment: "Winter forces focus. No distractions. I ship my best work when it's cold outside.",                                                   gender: "Female", ageRange: "Gen Z",      location: "Austin, United States",    experience: "6 Yrs",  image: null },
  { id: "demo-7", name: "David Kim",       role: "Data Analyst",    industry: "Technology",          response: "Autumn", comment: "The data always skews autumn. People are more reflective and honest in their responses.",                                              gender: "Male",   ageRange: "Millennial", location: "Seattle, United States",   experience: "8 Yrs",  image: null },
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name, image, size = 36 }: { name: string; image?: string | null; size?: number }) {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#10b981", "#3b82f6"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const px = `${size}px`;
  if (image) {
    return <img src={image} alt={name} className="rounded-full object-cover shrink-0" style={{ width: px, height: px }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold" style={{ width: px, height: px, backgroundColor: color, fontSize: size * 0.35 }}>
      {initials(name)}
    </div>
  );
}

function DemographicTag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted/40 text-[10px] text-foreground shrink-0">
      {icon}
      {label}
    </span>
  );
}

interface ChatPageProps {
  userName?: string;
}

export function ChatPage({ userName = "Dan" }: ChatPageProps) {
  useStoreSync();

  const athletes = getAthletes();
  const personas = athletes.length > 0
    ? athletes.map(a => ({
        id: a.id,
        name: a.name,
        role: a.sport ?? "Subject",
        industry: "Survey Participant",
        response: "—",
        comment: "No comment recorded yet.",
        gender: "—",
        ageRange: "—",
        location: "—",
        experience: "—",
        image: a.image ?? null,
      }))
    : DEMO_PERSONAS;

  const [selectedId, setSelectedId] = useState<string>(personas[0]?.id ?? "");
  const [conversations, setConversations] = useState<PersonaConversation[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = personas.find(p => p.id === selectedId) ?? personas[0];
  const currentConv = conversations.find(c => c.personaId === selectedId);
  const messages = currentConv?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 18 ? "Good afternoon" : "Good evening";

  function sendMessage(text: string) {
    if (!text.trim() || !selected) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: text.trim() };
    setConversations(prev => {
      const existing = prev.find(c => c.personaId === selected.id);
      if (existing) {
        return prev.map(c => c.personaId === selected.id ? { ...c, messages: [...c.messages, userMsg] } : c);
      }
      return [...prev, { personaId: selected.id, messages: [userMsg] }];
    });
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "persona",
        text: generateReply(text, selected),
      };
      setConversations(prev =>
        prev.map(c => c.personaId === selected.id ? { ...c, messages: [...c.messages, reply] } : c)
      );
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  }

  function generateReply(question: string, persona: typeof personas[0]): string {
    const q = question.toLowerCase();
    if (q.includes("why") || q.includes("reason")) return `${persona.comment}`;
    if (q.includes("change your mind")) return "Honestly, compelling data or a personal experience that challenged my assumptions. I'm open to being wrong.";
    if (q.includes("next option")) return `If not ${persona.response}, I'd probably lean toward whatever feels most honest to where I am right now.`;
    if (q.includes("up to") || q.includes("doing")) return "Mostly focused on the work in front of me. Each day brings its own set of challenges.";
    return `That's a great question. From my perspective as a ${persona.role}, ${persona.comment.toLowerCase()}`;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const showWelcome = messages.length === 0;

  return (
    <div className="h-full flex gap-2.5 p-2.5 bg-muted/30 overflow-hidden">

      {/* Left: persona list */}
      <aside className="w-[220px] shrink-0 bg-background border border-border rounded-2xl flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-2 shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left ${
                selectedId === p.id ? "bg-accent/10 border border-accent/20" : "hover:bg-muted/50"
              }`}
            >
              <Avatar name={p.name} image={p.image} size={32} />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-medium truncate ${selectedId === p.id ? "text-foreground" : "text-foreground/80"}`}>
                  {p.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{p.role} · {p.industry}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Center: chat area */}
      <div className="flex-1 min-w-0 bg-background border border-border rounded-2xl flex flex-col overflow-hidden relative">

        {/* Top nav */}
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors text-xs">
              <ChevronLeft className="size-3" />
              <span className="font-medium">{personas.length}</span>
            </button>
          </div>

          {/* Center: selected persona chip */}
          {selected && (
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
              <Avatar name={selected.name} image={selected.image} size={28} />
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-foreground">{selected.name}</span>
                <ChevronLeft className="size-2.5 text-muted-foreground rotate-180" />
              </div>
              <span className="text-[10px] text-muted-foreground">{selected.role}, {selected.industry}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <button className="size-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Pin">
              <Pin className="size-3.5" />
            </button>
            <button className="size-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
              <RefreshCw className="size-3.5" />
            </button>
            <button className="size-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Close">
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Messages / welcome */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {showWelcome ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
              <h2 className="text-2xl font-medium tracking-tight">{greeting}, {userName}</h2>

              {/* Primary input */}
              <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-sm px-4 py-4 flex items-center justify-between gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me a follow up question..."
                  className="flex-1 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mic className="size-4" />
                  <AudioWaveform className="size-4" />
                </div>
              </div>

              {/* Suggested chips */}
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-4 py-2 rounded-full border border-border bg-background text-xs hover:bg-muted/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.role === "persona" && selected && (
                    <Avatar name={selected.name} image={selected.image} size={28} />
                  )}
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-accent text-accent-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  {selected && <Avatar name={selected.name} image={selected.image} size={28} />}
                  <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom input bar */}
        <div className="shrink-0 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-2.5 bg-background border border-border rounded-2xl shadow-sm">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selected ? `Ask ${selected.name} a follow up question...` : "Ask a follow up question..."}
              className="flex-1 bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mic className="size-3.5" />
              <AudioWaveform className="size-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Right: bio sidebar */}
      {selected && (
        <aside className="w-[220px] shrink-0 bg-background border border-border rounded-2xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">

            {/* Profile header */}
            <div className="relative flex items-start gap-2.5">
              <Avatar name={selected.name} image={selected.image} size={40} />
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-1">
                  <p className="text-[13px] font-semibold truncate text-foreground">{selected.name}</p>
                  <Star className="size-2.5 text-amber-400 fill-amber-400 shrink-0" />
                </div>
                <p className="text-[10px] text-muted-foreground">{selected.role}</p>
              </div>
              <button
                onClick={() => setSelectedId("")}
                className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-3" />
              </button>
            </div>

            {/* Company */}
            <p className="text-[10px] text-foreground">ACME Corp.</p>

            {/* Demographic tags */}
            <div className="flex flex-wrap gap-1.5">
              <DemographicTag icon={<span className="text-[9px]">♂</span>} label={selected.gender} />
              <DemographicTag icon={<span className="text-[9px]">👤</span>} label={selected.ageRange} />
              <DemographicTag icon={<span className="text-[9px]">🏢</span>} label={selected.industry} />
              <DemographicTag icon={<span className="text-[9px]">📊</span>} label="Executive Level" />
              <DemographicTag icon={<span className="text-[9px]">📍</span>} label={selected.location} />
            </div>

            {/* Response */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">Response</p>
              <div className="border-l-2 border-indigo-500 pl-2">
                <p className="text-[10px] text-foreground">{selected.response}</p>
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">Comment</p>
              <p className="text-[10px] text-muted-foreground italic leading-relaxed">{selected.comment}</p>
            </div>

            {/* Profile details */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-foreground">Profile</p>
              <div className="space-y-2.5 text-[10px]">
                {[
                  { label: "Industry",   value: selected.industry  },
                  { label: "Age range",  value: selected.ageRange  },
                  { label: "Location",   value: selected.location  },
                  { label: "Experience", value: selected.experience },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: persona basis */}
          <div className="shrink-0 px-3 pb-3 space-y-2">
            <div className="h-20 rounded-xl bg-muted/50 border border-border overflow-hidden flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Persona map</span>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">What this persona is based on</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Public-figure persona modeled from on-the-record interviews, conference talks, and published writing.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}
