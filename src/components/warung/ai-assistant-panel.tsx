"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Mic,
  PackageSearch,
  Send,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Settings2,
  Power,
  Trash,
  Search,
  History,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tone = "default" | "warn" | "success";

type ToolResult = {
  ok: boolean;
  kind: "data" | "suggestion" | "action" | "preview" | "navigation" | "info";
  title: string;
  summary?: string;
  rows?: Array<{ label: string; value: string; tone?: Tone }>;
  data?: unknown;
  message?: string;
  error?: string;
};

type ChatRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ServerMessage = {
  id: string;
  chatId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  toolCalls: unknown;
  toolArgs: unknown;
  toolResult: ToolResult | null;
  createdAt: string;
};

const quickPrompts = [
  "Sisa stok semua produk?",
  "Untung minggu ini berapa?",
  "Pelanggan yang belum lunas?",
  "Rekomendasi restok untuk untung",
];

function friendlyErrorMessage(value: unknown, fallback = "Permintaan gagal.") {
  const raw =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : fallback;

  if (
    raw.includes("Gemini API") ||
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("Quota exceeded")
  ) {
    return "AI belum bisa dipakai saat ini karena kuota API habis atau belum aktif.";
  }

  if (raw.includes("IYH API") || raw.includes("model_not_allowed") || raw.includes("no models enabled")) {
    return raw.includes("model_not_allowed") || raw.includes("no models enabled")
      ? "IYH API key sudah terbaca, tetapi belum ada model yang aktif untuk key ini."
      : raw;
  }

  if (raw.includes("GEMINI_API_KEY")) {
    return "API key AI belum dikonfigurasi di server.";
  }

  return raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
}

async function api<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    const error = new Error(friendlyErrorMessage(data?.error, `Permintaan gagal (${res.status}).`));
    error.name = `HTTP_${res.status}`;
    throw error;
  }
  return data as T;
}

function MessageBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex w-full", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%]",
          role === "user"
            ? "rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-[0_12px_28px_-22px_rgba(186,92,35,0.85)]"
            : "w-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const parseInline = (str: string): React.ReactNode[] => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");

    if (isBullet) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const itemContent = line.replace(/^\s*[-*]\s*/, "");
      listItems.push(
        <li key={`li-${lineIndex}`} className="ml-4 list-disc pl-1 py-0.5">
          {parseInline(itemContent)}
        </li>
      );
    } else {
      if (inList) {
        elements.push(
          <ul key={`ul-${lineIndex}`} className="my-1.5 list-inside list-disc">
            {listItems}
          </ul>
        );
        inList = false;
        listItems = [];
      }
      
      if (trimmed === "") {
        elements.push(<div key={`br-${lineIndex}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${lineIndex}`} className="leading-relaxed">
            {parseInline(line)}
          </p>
        );
      }
    }
  });

  if (inList) {
    elements.push(
      <ul key="ul-final" className="my-1.5 list-inside list-disc">
        {listItems}
      </ul>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

function AssistantTextBubble({ text }: { text: string }) {
  return (
    <div className="rounded-3xl rounded-bl-md bg-card/80 px-4 py-2.5 text-sm text-foreground ring-1 ring-foreground/10 backdrop-blur">
      {parseMarkdown(text)}
    </div>
  );
}

function DataMessageCard({ result }: { result: ToolResult }) {
  return (
    <Card size="sm" className="bg-card/85 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PackageSearch className="size-4" />
          </span>
          <div className="flex-1">
            <CardTitle>{result.title}</CardTitle>
            {result.summary ? (
              <CardDescription className="mt-0.5 text-xs">{result.summary}</CardDescription>
            ) : null}
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            DB
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {(result.rows ?? []).map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{row.label}</span>
            <span
              className={cn(
                "text-sm font-medium",
                row.tone === "warn" && "text-amber-700",
                row.tone === "success" && "text-emerald-700"
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SuggestionMessageCard({ result }: { result: ToolResult }) {
  const data = result.data as { narrative?: string } | null;
  return (
    <Card
      size="sm"
      className="border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-amber-50/60 backdrop-blur"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <CardTitle className="flex-1">{result.title}</CardTitle>
          <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800">
            <TrendingUp className="size-3" />
            Saran
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.narrative ? (
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Ringkasan
            </p>
            <p className="text-sm text-foreground">{data.narrative}</p>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Top earner
          </p>
          {(result.rows ?? []).map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex items-center justify-between rounded-lg bg-card/70 px-3 py-2 ring-1 ring-foreground/5"
            >
              <span className="text-sm">{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionMessageCard({
  toolName,
  result,
}: {
  toolName: string | null;
  result: ToolResult;
}) {
  return (
    <Card size="sm" className="border-emerald-300/50 bg-emerald-50/70 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
            <Wallet className="size-4" />
          </span>
          <div className="flex-1">
            <CardTitle>{result.title}</CardTitle>
            {toolName ? (
              <CardDescription className="mt-0.5 font-mono text-[11px]">
                tool: {toolName}
              </CardDescription>
            ) : null}
          </div>
          <Badge variant="secondary" className="bg-emerald-200/70 text-emerald-900">
            Tereksekusi
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.summary ? (
          <p className="text-sm font-medium text-foreground">{result.summary}</p>
        ) : null}
        <div className="rounded-xl bg-card/70 p-2.5 ring-1 ring-emerald-200/70">
          {(result.rows ?? []).map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex items-center justify-between gap-2 border-b border-dashed border-emerald-200/70 py-1 text-sm last:border-0"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={cn(
                  "font-medium",
                  row.tone === "warn" && "text-amber-700",
                  row.tone === "success" && "text-emerald-700"
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-emerald-100/80 px-3 py-2 text-xs text-emerald-800">
          <Check className="size-3.5" />
          Aksi sudah disimpan ke database.
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewMessageCard({
  message,
  result,
  onCommitted,
}: {
  message: ServerMessage;
  result: ToolResult;
  onCommitted: (messageId: string, result: ToolResult) => void;
}) {
  const data = result.data as
    | { toolName?: string; payload?: unknown; signature?: string; pending?: boolean }
    | null;
  const [isCommitting, setIsCommitting] = useState(false);

  async function handleCommit() {
    if (!message.toolCallId || !data?.toolName || !data?.payload || !data?.signature) {
      toast.error("Data konfirmasi AI tidak lengkap.");
      return;
    }

    setIsCommitting(true);
    try {
      const response = await api<{ result: ToolResult }>("/api/ai/tools/commit", {
        method: "POST",
        body: JSON.stringify({
          messageId: message.id,
          toolCallId: message.toolCallId,
          toolName: data.toolName,
          payload: data.payload,
          signature: data.signature,
        }),
      });
      onCommitted(message.id, response.result);
      toast.success("Aksi AI berhasil dijalankan.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error, "Gagal menjalankan aksi AI."));
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <Card size="sm" className="border-amber-300/70 bg-amber-50/80 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
            <AlertTriangle className="size-4" />
          </span>
          <div className="flex-1">
            <CardTitle>{result.title}</CardTitle>
            {result.summary ? (
              <CardDescription className="mt-0.5 text-xs">{result.summary}</CardDescription>
            ) : null}
          </div>
          <Badge variant="secondary" className="bg-amber-200/70 text-amber-900">
            Menunggu
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-card/75 p-2.5 ring-1 ring-amber-200/70">
          {(result.rows ?? []).map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="flex items-center justify-between gap-2 border-b border-dashed border-amber-200/80 py-1 text-sm last:border-0"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl"
          onClick={() => void handleCommit()}
          disabled={isCommitting}
        >
          {isCommitting ? "Menjalankan..." : "Konfirmasi & Jalankan"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InfoMessageCard({ result }: { result: ToolResult }) {
  return (
    <Card size="sm" className="bg-card/85 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              result.ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive"
            )}
          >
            {result.ok ? <BookOpen className="size-4" /> : <AlertTriangle className="size-4" />}
          </span>
          <CardTitle className="flex-1">{result.title}</CardTitle>
        </div>
      </CardHeader>
      {result.message || result.error ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{result.message ?? result.error}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

function NavigationMessageCard({ result }: { result: ToolResult }) {
  const data = (result.data ?? {}) as { href?: string; label?: string };
  return (
    <Card size="sm" className="bg-card/85 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <ChevronRight className="size-4" />
          </span>
          <CardTitle className="flex-1">{result.title}</CardTitle>
        </div>
      </CardHeader>
      {data.href ? (
        <CardContent>
          <a
            href={data.href}
            className="group/nav flex w-full items-center justify-between rounded-xl bg-muted px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
          >
            <div>
              <p className="text-xs text-muted-foreground">Tujuan</p>
              <p className="text-sm font-medium">{data.label ?? data.href}</p>
              <p className="text-[11px] font-mono text-muted-foreground">{data.href}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover/nav:translate-x-0.5" />
          </a>
        </CardContent>
      ) : null}
    </Card>
  );
}

function ToolCard({
  message,
  onCommitted,
}: {
  message: ServerMessage;
  onCommitted: (messageId: string, result: ToolResult) => void;
}) {
  const result = message.toolResult;
  if (!result) return null;
  switch (result.kind) {
    case "data":
      return <DataMessageCard result={result} />;
    case "suggestion":
      return <SuggestionMessageCard result={result} />;
    case "action":
      return <ActionMessageCard toolName={message.toolName} result={result} />;
    case "preview":
      return <PreviewMessageCard message={message} result={result} onCommitted={onCommitted} />;
    case "navigation":
      return <NavigationMessageCard result={result} />;
    case "info":
    default:
      return <InfoMessageCard result={result} />;
  }
}

export function AIAssistantPanel({
  open,
  onOpenChange,
  width = 420,
  role = "pimpinan",
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  width?: number;
  role?: string;
}) {
  const canDeleteChat = role !== "kasir";
  const [chat, setChat] = useState<ChatRecord | null>(null);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasBootstrappedRef = useRef(false);

  const [chatHistory, setChatHistory] = useState<ChatRecord[]>([]);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [searchHistory, setSearchHistory] = useState("");
  const [usage, setUsage] = useState({ totalRequests: 0, estimatedTokens: 0, costRp: 0 });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("warungos_ai_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.aiEnabled === "boolean") setAiEnabled(parsed.aiEnabled);
        if (parsed.usage) setUsage(parsed.usage);
      }
    } catch (err) {}
  }, []);

  function saveUsage(addTokens: number) {
    setUsage((prev) => {
      const next = {
        totalRequests: prev.totalRequests + 1,
        estimatedTokens: prev.estimatedTokens + addTokens,
        costRp: prev.costRp + Math.ceil(addTokens * 0.05),
      };
      localStorage.setItem("warungos_ai_settings", JSON.stringify({ aiEnabled, usage: next }));
      return next;
    });
  }

  function toggleAiEnabled() {
    const next = !aiEnabled;
    setAiEnabled(next);
    localStorage.setItem("warungos_ai_settings", JSON.stringify({ aiEnabled: next, usage }));
    toast.success(next ? "AI Assistant diaktifkan." : "AI Assistant dinonaktifkan.");
  }

  const bootstrap = useCallback(async () => {
    if (hasBootstrappedRef.current) return;
    hasBootstrappedRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const list = await api<{ chats: ChatRecord[] }>("/api/ai/chats");
      setChatHistory(list.chats);
      let active = list.chats[0] ?? null;
      if (!active) {
        const created = await api<{ chat: ChatRecord }>("/api/ai/chats", {
          method: "POST",
          body: JSON.stringify({ title: "Percakapan baru" }),
        });
        active = created.chat;
        setChatHistory(prev => [active, ...prev]);
      }
      setChat(active);
      try {
        const detail = await api<{ messages: ServerMessage[] }>(
          `/api/ai/chats/${active.id}/messages`
        );
        setMessages(detail.messages);
      } catch (err) {
        if (err instanceof Error && err.name === "HTTP_404") {
          const created = await api<{ chat: ChatRecord }>("/api/ai/chats", {
            method: "POST",
            body: JSON.stringify({ title: "Percakapan baru" }),
          });
          setChat(created.chat);
      setChatHistory(prev => [created.chat, ...prev]);
      setMessages([]);
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(friendlyErrorMessage(err, "Gagal memuat chat AI."));
      hasBootstrappedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void bootstrap();
  }, [open, bootstrap]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [open, messages, isThinking]);

  async function handleSend(text: string) {
    if (!aiEnabled) {
      toast.error("AI Assistant sedang dinonaktifkan. Silakan aktifkan di Pengaturan.");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || !chat || isThinking) return;

    const optimistic: ServerMessage = {
      id: `local_${Date.now()}`,
      chatId: chat.id,
      role: "user",
      content: trimmed,
      toolName: null,
      toolCallId: null,
      toolCalls: null,
      toolArgs: null,
      toolResult: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setIsThinking(true);
    setError(null);

    try {
      let activeChat = chat;
      let res: { newMessages: ServerMessage[] };
      try {
        res = await api<{ newMessages: ServerMessage[] }>(
          `/api/ai/chats/${activeChat.id}/messages`,
          { method: "POST", body: JSON.stringify({ text: trimmed }) }
        );
      } catch (err) {
        if (!(err instanceof Error) || err.name !== "HTTP_404") {
          throw err;
        }

        const created = await api<{ chat: ChatRecord }>("/api/ai/chats", {
          method: "POST",
          body: JSON.stringify({ title: trimmed.slice(0, 80) || "Percakapan baru" }),
        });
        activeChat = created.chat;
        setChat(activeChat);
        setChatHistory(prev => [activeChat, ...prev]);
res = await api<{ newMessages: ServerMessage[] }>(
          `/api/ai/chats/${activeChat.id}/messages`,
          { method: "POST", body: JSON.stringify({ text: trimmed }) }
        );
      }
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        ...res.newMessages,
      ]);
      saveUsage(trimmed.length * 2 + 350);
    } catch (err) {
      const message = friendlyErrorMessage(err, "Gagal mengirim pesan.");
      setError(message);
      toast.error(message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setIsThinking(false);
    }
  }

  async function handleNewChat() {
    setIsLoading(true);
    setError(null);
    try {
      const created = await api<{ chat: ChatRecord }>("/api/ai/chats", {
        method: "POST",
        body: JSON.stringify({ title: "Percakapan baru" }),
      });
      setChat(created.chat);
      setMessages([]);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Gagal membuat chat baru."));
    } finally {
      setIsLoading(false);
    }
  }

  function handleToolCommitted(messageId: string, result: ToolResult) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: JSON.stringify(result),
              toolResult: result,
            }
          : message
      )
    );
  }

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden rounded-[26px] border border-white/60 bg-card/85 shadow-[0_38px_90px_-50px_rgba(68,39,20,0.7)] backdrop-blur-xl transition-[width] duration-200 ease-out",
        open ? "" : "w-[52px]"
      )}
      style={open ? { width } : undefined}
      aria-label="Asisten AI WarungOS"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="group/rail flex h-full w-full flex-col items-center justify-center gap-3 px-1.5 py-4 text-foreground/80 transition-colors hover:bg-primary/5"
          aria-label="Buka asisten AI"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_18px_38px_-22px_rgba(186,92,35,0.85)] transition-transform group-hover/rail:scale-105">
            <Sparkles className="size-4" />
          </span>
          <span
            className="text-[10px] font-medium tracking-wide text-foreground/70"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Asisten AI
          </span>
          <span className="mt-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
            ●
          </span>
        </button>
      ) : (
        <>
          <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-sm font-semibold leading-tight truncate">
                {chat?.title ?? "WarungOS AI"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Asisten kontekstual · Gemini 2.5 Flash · Tool calling
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNewChat}
              disabled={isLoading || isThinking || view === "settings"}
              aria-label="Reset chat"
              title="Reset chat"
            >
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
              aria-label="Pengaturan"
              title="Pengaturan"
            >
              <Settings2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Tutup asisten"
              title="Tutup asisten"
            >
              <X className="size-4" />
            </Button>
          </header>

                    {view === "settings" ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-card/40 p-4">
              <div className="space-y-6">
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Power className="size-4 text-primary" />
                    Status Layanan AI
                  </h3>
                  <div className="flex items-center justify-between rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                    <div>
                      <p className="text-sm font-medium">Asisten Cerdas</p>
                      <p className="text-xs text-muted-foreground">Aktifkan untuk menggunakan chat AI</p>
                    </div>
                    <Button
                      variant={aiEnabled ? "default" : "secondary"}
                      size="sm"
                      className="rounded-xl"
                      onClick={toggleAiEnabled}
                    >
                      {aiEnabled ? "Aktif" : "Nonaktif"}
                    </Button>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Activity className="size-4 text-emerald-600" />
                    Penggunaan API (Estimasi)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                      <p className="text-[10px] uppercase text-muted-foreground">Total Request</p>
                      <p className="mt-1 text-lg font-bold">{usage.totalRequests}</p>
                    </div>
                    <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                      <p className="text-[10px] uppercase text-muted-foreground">Estimasi Biaya</p>
                      <p className="mt-1 text-lg font-bold text-amber-700">
                        Rp {usage.costRp.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    *Biaya dihitung dari kisaran ~{usage.estimatedTokens.toLocaleString("id-ID")} token tercatat secara lokal.
                  </p>
                </section>

                <section className="pb-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <History className="size-4 text-primary" />
                    Riwayat Percakapan
                  </h3>
                  <div className="mb-3 relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari riwayat..."
                      value={searchHistory}
                      onChange={(e) => setSearchHistory(e.target.value)}
                      className="w-full rounded-xl border-none bg-card py-2 pl-9 pr-3 text-sm ring-1 ring-border focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    {chatHistory
                      .filter((c) => c.title.toLowerCase().includes(searchHistory.toLowerCase()))
                      .slice(0, 15)
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border">
                          <div
                            className="flex-1 cursor-pointer truncate"
                            onClick={async () => {
                              try {
                                setIsLoading(true);
                                setChat(c);
                                const detail = await api<{ messages: ServerMessage[] }>(
                                  `/api/ai/chats/${c.id}/messages`
                                );
                                setMessages(detail.messages);
                                setView("chat");
                              } catch (err) {
                                toast.error("Gagal memuat riwayat ini.");
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                          >
                            <p className="truncate text-sm font-medium">{c.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(c.updatedAt).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                            </p>
                          </div>
                          {canDeleteChat && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={async () => {
                                try {
                                  await api(`/api/ai/chats/${c.id}`, { method: "DELETE" });
                                  setChatHistory((prev) => prev.filter((item) => item.id !== c.id));
                                  if (chat?.id === c.id) {
                                    handleNewChat();
                                  }
                                  toast.success("Riwayat dihapus.");
                                } catch (err) {
                                  toast.error("Gagal menghapus riwayat.");
                                }
                              }}
                            >
                              <Trash className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    {chatHistory.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-4">Belum ada riwayat percakapan.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-3 px-4 py-4">
              {!isLoading ? (
                <MessageBubble role="assistant">
                  <AssistantTextBubble
                    text={
                      "Halo Pak/Bu! Saya WarungOS AI. Saya bisa cek stok, hitung untung, kasih saran restok, atau langsung jalankan aksi (catat hutang, restok, catat pengeluaran). Coba tanya: 'untung minggu ini berapa?' atau 'rekomendasi restok untuk untung'."
                    }
                  />
                </MessageBubble>
              ) : null}

              {visibleMessages.map((m) => {
                if (m.role === "user") {
                  return (
                    <MessageBubble key={m.id} role="user">
                      <span>{m.content}</span>
                    </MessageBubble>
                  );
                }
                if (m.role === "assistant") {
                  if (!m.content.trim()) return null;
                  return (
                    <MessageBubble key={m.id} role="assistant">
                      <AssistantTextBubble text={m.content} />
                    </MessageBubble>
                  );
                }
                if (m.role === "tool") {
                  return (
                    <MessageBubble key={m.id} role="assistant">
                      <ToolCard message={m} onCommitted={handleToolCommitted} />
                    </MessageBubble>
                  );
                }
                return null;
              })}

              {isThinking ? (
                <MessageBubble role="assistant">
                  <div className="inline-flex items-center gap-1.5 rounded-3xl rounded-bl-md bg-card/80 px-4 py-3 ring-1 ring-foreground/10">
                    <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                  </div>
                </MessageBubble>
              ) : null}

              {error ? (
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}
              <div ref={bottomRef} aria-hidden className="h-px" />
            </div>
          </div>

          <div className="border-t border-border/60 bg-card/70 px-3 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSend(q)}
                  disabled={isThinking || !chat}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground/80 ring-1 ring-foreground/5 transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                >
                  <ArrowRight className="size-3" />
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Tanya stok, untung, atau perintahkan tindakan…"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-card/80 py-2.5"
                rows={1}
                disabled={!chat}
              />
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-2xl"
                onClick={() => toast.info("Voice input belum tersedia.")}
                aria-label="Rekam suara"
              >
                <Mic className="size-4" />
              </Button>
              <Button
                size="icon-lg"
                className="rounded-2xl"
                onClick={() => handleSend(input)}
                disabled={!input.trim() || isThinking || !chat}
                aria-label="Kirim pesan"
              >
                <Send className="size-4" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Aksi AI yang mengubah data butuh konfirmasi sebelum disimpan.
            </p>
          </div>
            </>
          )}
        </>
      )}
    </aside>
  );
}
