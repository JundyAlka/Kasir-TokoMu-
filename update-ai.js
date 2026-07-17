const fs = require('fs');
let code = fs.readFileSync('src/components/warung/ai-assistant-panel.tsx', 'utf8');

code = code.replace(
  /  X,\r?\n\} from \"lucide-react\";/,
  '  X,\n  Settings2,\n  Power,\n  Trash,\n  Search,\n  History,\n  Activity,\n} from \"lucide-react\";'
);

code = code.replace(
  /const bottomRef = useRef<HTMLDivElement>\(null\);\r?\n\s+const hasBootstrappedRef = useRef\(false\);/,
  `const bottomRef = useRef<HTMLDivElement>(null);
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
  }`
);

code = code.replace(
  /const list = await api<{ chats: ChatRecord\[\] }>\(\"\/api\/ai\/chats\"\);\r?\n\s+let active = list\.chats\[0\] \?\? null;/,
  `const list = await api<{ chats: ChatRecord[] }>(\"/api/ai/chats\");
      setChatHistory(list.chats);
      let active = list.chats[0] ?? null;`
);

code = code.replace(
  /active = created\.chat;\r?\n\s+\}/,
  `active = created.chat;
        setChatHistory(prev => [active, ...prev]);
      }`
);

code = code.replace(
  /async function handleSend\(text: string\) \{\r?\n\s+const trimmed = text\.trim\(\);/,
  `async function handleSend(text: string) {
    if (!aiEnabled) {
      toast.error("AI Assistant sedang dinonaktifkan. Silakan aktifkan di Pengaturan.");
      return;
    }
    const trimmed = text.trim();`
);

code = code.replace(
  /setChat\(activeChat\);\r?\n\s+res = await api<{ newMessages: ServerMessage\[\] }>\(/,
  `setChat(activeChat);
        setChatHistory(prev => [activeChat, ...prev]);
        res = await api<{ newMessages: ServerMessage[] }>(`
);

code = code.replace(
  /setChat\(created\.chat\);\r?\n\s+setMessages\(\[\]\);/,
  `setChat(created.chat);
      setChatHistory(prev => [created.chat, ...prev]);
      setMessages([]);`
);

code = code.replace(
  /\.\.\.res\.newMessages,\r?\n\s+\]\);\r?\n\s+\} catch \(err\)/,
  `...res.newMessages,
      ]);
      saveUsage(trimmed.length * 2 + 350);
    } catch (err)`
);

code = code.replace(
  /<ArrowRight className=\"size-4\" \/>\r?\n\s+<\/Button>\r?\n\s+<Button\r?\n\s+variant=\"ghost\"/,
  `<ArrowRight className="size-4" />
            </Button>
            <Button
              variant={view === "settings" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
              aria-label="Pengaturan"
              title="Pengaturan"
            >
              <Settings2 className="size-4" />
            </Button>
            <Button
              variant="ghost"`
);

code = code.replace(
  /disabled=\{isLoading \|\| isThinking\}/,
  `disabled={isLoading || isThinking || view === "settings"}`
);

const renderBlock = `          {view === "settings" ? (
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
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border">
                          <div
                            className="flex-1 cursor-pointer truncate"
                            onClick={async () => {
                              try {
                                setIsLoading(true);
                                setChat(c);
                                const detail = await api<{ messages: ServerMessage[] }>(
                                  \`/api/ai/chats/\${c.id}/messages\`
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={async () => {
                              try {
                                await api(\`/api/ai/chats/\${c.id}\`, { method: "DELETE" });
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
                <div className="space-y-3 px-4 py-4">`;

code = code.replace(
  /<div className=\"flex-1 min-h-0 overflow-y-auto\">\r?\n\s+<div className=\"space-y-3 px-4 py-4\">/,
  renderBlock
);

code = code.replace(
  /<p className=\"mt-2 text-\[10px\] text-muted-foreground\">\r?\n\s+Aksi AI yang mengubah data butuh konfirmasi sebelum disimpan\.\r?\n\s+<\/p>\r?\n\s+<\/div>/,
  `<p className="mt-2 text-[10px] text-muted-foreground">
              Aksi AI yang mengubah data butuh konfirmasi sebelum disimpan.
            </p>
          </div>
            </>
          )`
);

fs.writeFileSync('src/components/warung/ai-assistant-panel.tsx', code);
console.log('Update success');
