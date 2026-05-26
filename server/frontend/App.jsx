import { useState, useEffect, useCallback, useMemo } from "react";
import AnalyticsPanel from "./AnalyticsPanel.jsx";

const API_BASE = "http://localhost:8080";

/* ─── Design tokens ───────────────────────────────────────────────────────── */
const T = {
  bg0:      "#080c14",
  bg1:      "#0d1320",
  bg2:      "#111a2e",
  bg3:      "#172038",
  border:   "#1e2d4a",
  border2:  "#2a3f60",
  amber:    "#f5a623",
  amberDim: "#8a5c10",
  amberGlow:"rgba(245,166,35,0.12)",
  cyan:     "#38bdf8",
  cyanDim:  "rgba(56,189,248,0.15)",
  green:    "#4ade80",
  greenDim: "rgba(74,222,128,0.13)",
  red:      "#f87171",
  redDim:   "rgba(248,113,113,0.13)",
  text:     "#e2eaf8",
  textMid:  "#8da3c4",
  textDim:  "#4a6080",
  mono:     "'JetBrains Mono', 'Fira Mono', 'Cascadia Code', monospace",
  sans:     "'DM Sans', 'Sora', system-ui, sans-serif",
};

const G = {
  fonts: `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
  `,
  base: `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg0}; color: ${T.text}; font-family: ${T.sans}; }
    input, select, textarea, button {
      font-family: ${T.sans}; font-size: 14px; outline: none;
      background: ${T.bg2}; color: ${T.text};
      border: 1px solid ${T.border2};
      border-radius: 6px;
    }
    input, select { padding: 9px 12px; width: 100%; }
    textarea { padding: 9px 12px; width: 100%; resize: vertical; }
    input::placeholder, textarea::placeholder { color: ${T.textDim}; }
    input:focus, select:focus, textarea:focus { border-color: ${T.amber}; box-shadow: 0 0 0 3px ${T.amberGlow}; }
    button { cursor: pointer; padding: 9px 18px; border-color: ${T.border2}; transition: all .15s; }
    button:hover { border-color: ${T.amber}; color: ${T.amber}; background: ${T.amberGlow}; }
    button:active { transform: scale(0.97); }
    select option { background: ${T.bg2}; }

    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin   { to { transform: rotate(360deg); } }
    @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:.4; } }
    @keyframes scanline {
      0% { background-position: 0 0; }
      100% { background-position: 0 100px; }
    }

    .fade-up { animation: fadeUp .35s ease both; }
    .fade-up-1 { animation: fadeUp .35s .05s ease both; }
    .fade-up-2 { animation: fadeUp .35s .1s ease both; }
    .fade-up-3 { animation: fadeUp .35s .15s ease both; }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: ${T.bg1}; }
    ::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 3px; }
  `,
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function parseJwt(t) {
  try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; }
}
async function api(path, opts = {}, token = null) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE}${path}`, { ...opts, headers: h });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, data: d };
}

/* ─── Primitive components ────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3800); return () => clearTimeout(t); }, [onClose]);
  const accent = type === "ok" ? T.green : type === "err" ? T.red : T.amber;
  const dim    = type === "ok" ? T.greenDim : type === "err" ? T.redDim : T.amberGlow;
  return (
      <div style={{
        position:"fixed", bottom:24, right:24, zIndex:9999,
        background: T.bg2, border:`1px solid ${accent}`,
        boxShadow:`0 0 24px ${dim}`,
        borderRadius:8, padding:"12px 16px",
        display:"flex", alignItems:"center", gap:10,
        fontFamily:T.mono, fontSize:13, color:accent,
        maxWidth:360, animation:"fadeUp .25s ease",
      }}>
      <span style={{ fontSize:16 }}>
        {type==="ok"?"✓" : type==="err"?"✗" : "⚡"}
      </span>
        <span style={{ flex:1 }}>{msg}</span>
        <button onClick={onClose} style={{
          background:"none", border:"none", color:T.textDim,
          padding:0, fontSize:16, lineHeight:1,
        }}>✕</button>
      </div>
  );
}

function Pill({ children, color = T.amber, bg }) {
  return (
      <span style={{
        fontFamily:T.mono, fontSize:11, fontWeight:600,
        color, background: bg || `${color}20`,
        border:`1px solid ${color}40`,
        borderRadius:4, padding:"2px 8px",
        letterSpacing:"0.04em", textTransform:"uppercase",
      }}>{children}</span>
  );
}

function Section({ children, style={} }) {
  return (
      <div style={{
        background: T.bg1, border:`1px solid ${T.border}`,
        borderRadius:10, padding:"1.5rem",
        ...style
      }}>{children}</div>
  );
}

function SectionHead({ title, icon, action }) {
  return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18, color:T.amber }}>{icon}</span>
          <span style={{ fontFamily:T.mono, fontSize:13, fontWeight:600, color:T.amber, letterSpacing:"0.08em", textTransform:"uppercase" }}>{title}</span>
        </div>
        {action}
      </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontFamily:T.mono, fontSize:11, color:T.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>{children}</div>;
}

function SubmitBtn({ children, loading, style={} }) {
  return (
      <button type="submit" disabled={loading} style={{
        width:"100%", padding:"11px", marginTop:4,
        background: loading ? T.bg3 : T.amberGlow,
        border:`1px solid ${loading ? T.border2 : T.amber}`,
        color: loading ? T.textDim : T.amber,
        fontFamily:T.mono, fontSize:13, fontWeight:600,
        letterSpacing:"0.1em", textTransform:"uppercase",
        borderRadius:6, transition:"all .2s",
        boxShadow: loading ? "none" : `0 0 16px ${T.amberGlow}`,
        ...style,
      }}>
        {loading ? "[ processing… ]" : children}
      </button>
  );
}

function Spinner() {
  return (
      <div style={{ textAlign:"center", padding:"2.5rem", color:T.textDim, fontFamily:T.mono, fontSize:13 }}>
        <div style={{ display:"inline-block", width:20, height:20, border:`2px solid ${T.border2}`, borderTopColor:T.amber, borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:10 }} />
        <div>loading…</div>
      </div>
  );
}

function Empty({ msg }) {
  return (
      <div style={{ textAlign:"center", padding:"2.5rem", color:T.textDim, fontFamily:T.mono, fontSize:13 }}>
        <div style={{ fontSize:28, marginBottom:10, opacity:.4 }}>◈</div>
        {msg}
      </div>
  );
}

function StatCard({ label, value, sub, color = T.amber, accent }) {
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "14px 16px", flex: 1, minWidth: 140,
      boxShadow: accent ? `0 0 20px ${accent}` : "none",
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: T.mono, fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMid, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function parseLogRaw(log) {
  try {
    return typeof log.raw_data === "string" ? JSON.parse(log.raw_data) : (log.raw_data || {});
  } catch {
    return {};
  }
}

function getLogEmailMeta(log) {
  const raw = parseLogRaw(log);
  return {
    subject: raw.emailMeta?.subject || raw.subject || "",
    sender: raw.emailMeta?.sender || raw.sender || "",
    riskScore: raw.basicAnalysis?.score,
    riskLevel: raw.basicAnalysis?.riskLevel,
  };
}

function ThreatBar({ threatPct }) {
  const cleanPct = 100 - threatPct;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.border}` }}>
        <div style={{ width: `${threatPct}%`, background: T.red, transition: "width .4s ease" }} />
        <div style={{ width: `${cleanPct}%`, background: T.green, transition: "width .4s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
        <span style={{ color: T.red }}>threat {threatPct}%</span>
        <span style={{ color: T.green }}>clean {cleanPct}%</span>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, color = T.amber }) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${color}20` : T.bg2,
      border: `1px solid ${active ? color + "60" : T.border}`,
      color: active ? color : T.textDim,
      fontFamily: T.mono, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "6px 12px", borderRadius: 6,
    }}>{children}</button>
  );
}

/* ─── Auth screen ─────────────────────────────────────────────────────────── */
function AuthScreen({ onLogin, toast }) {
  const [tab, setTab]   = useState("login");
  const [orgs, setOrgs] = useState([]);
  const [form, setForm] = useState({ username:"", password:"", org_id:"" });
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/organizations").then(({ data }) => { if (Array.isArray(data)) setOrgs(data); });
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true);
    if (tab === "login") {
      const { ok, data } = await api("/auth/login", { method:"POST", body:JSON.stringify({ username:form.username, password:form.password }) });
      setBusy(false);
      if (ok) { onLogin(data.token); toast("Access granted", "ok"); }
      else toast(data.error || "Authentication failed", "err");
    } else if (tab === "register") {
      const body = { username:form.username, password:form.password };
      if (form.org_id) body.organization_id = Number(form.org_id);
      const { ok, data } = await api("/auth/register", { method:"POST", body:JSON.stringify(body) });
      setBusy(false);
      if (ok) { toast(data.message || "Registered. Please sign in.", "ok"); setTab("login"); }
      else toast(data.error || "Registration failed", "err");
    } else {
      const { ok, data } = await api("/api/organizations", { method:"POST", body:JSON.stringify({ name:orgName }) });
      setBusy(false);
      if (ok) {
        toast(`Org created — admin: ${data.default_admin?.username} / admin`, "ok");
        const { data:updated } = await api("/api/organizations");
        if (Array.isArray(updated)) setOrgs(updated);
        setTab("login");
      } else toast(data.error || "Failed", "err");
    }
  }

  const tabs = [
    { key:"login",      label:"sign_in" },
    { key:"register",   label:"register" },
    { key:"new_org",    label:"new_org" },
  ];

  return (
      <div style={{
        minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        background:`radial-gradient(ellipse 80% 60% at 50% 0%, #0d1e38 0%, ${T.bg0} 70%)`,
        padding:"2rem",
      }}>
        <style>{G.fonts}{G.base}</style>

        {/* Logo mark */}
        <div className="fade-up" style={{ marginBottom:"2.5rem", textAlign:"center" }}>
          <div style={{
            width:56, height:56, borderRadius:12, margin:"0 auto 14px",
            background:T.amberGlow, border:`1px solid ${T.amber}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:26, boxShadow:`0 0 40px ${T.amberGlow}`,
          }}>🛡</div>
          <div style={{ fontFamily:T.mono, fontSize:22, fontWeight:600, color:T.text, letterSpacing:"0.05em" }}>
            SENTRY<span style={{ color:T.amber }}>_</span>LOG
          </div>
          <div style={{ fontFamily:T.mono, fontSize:11, color:T.textDim, marginTop:4, letterSpacing:"0.15em" }}>
            PHISHING DETECTION PLATFORM
          </div>
        </div>

        {/* Card */}
        <div className="fade-up-1" style={{
          width:"100%", maxWidth:420,
          background:T.bg1, border:`1px solid ${T.border}`,
          borderRadius:12, padding:"2rem",
          boxShadow:`0 0 80px rgba(0,0,0,.6), 0 0 1px ${T.border2} inset`,
        }}>
          {/* Tab bar */}
          <div style={{ display:"flex", gap:2, marginBottom:"1.75rem", background:T.bg0, padding:3, borderRadius:8, border:`1px solid ${T.border}` }}>
            {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex:1, border:"none", borderRadius:6,
                  background: tab===t.key ? T.bg3 : "transparent",
                  color: tab===t.key ? T.amber : T.textDim,
                  fontFamily:T.mono, fontSize:11, fontWeight:600,
                  letterSpacing:"0.08em", padding:"7px 4px",
                  boxShadow: tab===t.key ? `0 0 12px ${T.amberGlow}` : "none",
                  transition:"all .2s",
                }}>
                  {t.label}
                </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {tab !== "new_org" ? (
                <>
                  <div style={{ marginBottom:14 }}>
                    <FieldLabel>username</FieldLabel>
                    <input value={form.username} onChange={set("username")} placeholder="operator_id" required autoComplete="username" />
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <FieldLabel>password</FieldLabel>
                    <input type="password" value={form.password} onChange={set("password")} placeholder="••••••••••" required autoComplete="current-password" />
                  </div>
                  {tab === "register" && (
                      <div style={{ marginBottom:14 }}>
                        <FieldLabel>apply to organization (optional)</FieldLabel>
                        <select value={form.org_id} onChange={set("org_id")}>
                          <option value="">— none —</option>
                          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                        {form.org_id && (
                            <div style={{ marginTop:8, padding:"8px 12px", background:T.bg3, border:`1px solid ${T.amberDim}`, borderRadius:6, fontFamily:T.mono, fontSize:11, color:T.amber }}>
                              ⚡ your membership will require admin approval
                            </div>
                        )}
                      </div>
                  )}
                  <SubmitBtn loading={busy}>
                    {tab==="login" ? "[ authenticate → ]" : "[ create account → ]"}
                  </SubmitBtn>
                </>
            ) : (
                <>
                  <div style={{ marginBottom:14 }}>
                    <FieldLabel>organization name</FieldLabel>
                    <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="AcmeCorp" required />
                  </div>
                  <div style={{ padding:"10px 12px", marginBottom:14, background:T.bg3, border:`1px solid ${T.amberDim}`, borderRadius:6, fontFamily:T.mono, fontSize:11, color:T.amber, lineHeight:1.7 }}>
                    ⚠ default admin will be created:<br/>
                    <strong>{orgName||"orgName"}Admin</strong> / <strong>admin</strong><br/>
                    change credentials immediately after first login
                  </div>
                  <SubmitBtn loading={busy}>[ deploy organization → ]</SubmitBtn>
                </>
            )}
          </form>
        </div>

        <div className="fade-up-2" style={{ marginTop:"1.5rem", fontFamily:T.mono, fontSize:11, color:T.textDim, letterSpacing:"0.1em" }}>
          v1.0.0 · secured channel
        </div>
      </div>
  );
}

/* ─── Logs panel ──────────────────────────────────────────────────────────── */
function LogsPanel({ token, user, toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExp] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api("/api/logs", {}, token);
    setLoading(false);
    if (ok) setLogs(Array.isArray(data) ? data : []);
    else toast(data.error || "Failed to load logs", "err");
  }, [token, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const threats = logs.filter(l => !!l.phishing_detected).length;
    const clean = total - threats;
    const threatPct = total ? Math.round((threats / total) * 100) : 0;
    const cleanPct = total ? Math.round((clean / total) * 100) : 0;
    return { total, threats, clean, threatPct, cleanPct };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 86400000;

    let list = logs.filter(log => {
      if (statusFilter === "threat" && !log.phishing_detected) return false;
      if (statusFilter === "clean" && log.phishing_detected) return false;
      if (modeFilter !== "all" && log.analysis_mode !== modeFilter) return false;

      if (dateFilter !== "all") {
        const ts = new Date(log.timestamp).getTime();
        const days = dateFilter === "today" ? 1 : dateFilter === "7d" ? 7 : 30;
        if (now - ts > days * dayMs) return false;
      }

      if (q) {
        const meta = getLogEmailMeta(log);
        const haystack = [
          meta.subject, meta.sender, log.analysis_mode, log.ai_provider,
          log.username, String(log.id),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortDir === "desc" ? tb - ta : ta - tb;
    });

    return list;
  }, [logs, statusFilter, modeFilter, dateFilter, search, sortDir]);

  const modes = useMemo(() => [...new Set(logs.map(l => l.analysis_mode).filter(Boolean))], [logs]);

  function exportLogs() {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentrylog-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`exported ${filteredLogs.length} log(s)`, "ok");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Stats */}
      <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard label="emails scanned" value={stats.total} sub="total in feed" color={T.cyan} />
        <StatCard label="threats detected" value={stats.threats} sub={`${stats.threatPct}% of scans`} color={T.red} accent={stats.threats ? T.redDim : undefined} />
        <StatCard label="clean emails" value={stats.clean} sub={`${stats.cleanPct}% of scans`} color={T.green} />
        <StatCard label="threat rate" value={`${stats.threatPct}%`} sub={stats.total ? `${stats.threats} / ${stats.total} flagged` : "no data yet"} color={T.amber} />
      </div>

      {stats.total > 0 && (
        <Section className="fade-up-1" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
            scan distribution
          </div>
          <ThreatBar threatPct={stats.threatPct} />
        </Section>
      )}

      {/* Feed */}
      <Section className="fade-up-2" style={{ minHeight: 400 }}>
        <SectionHead
          title={user?.role === "admin" ? "org threat feed" : "my threat feed"}
          icon="◈"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setAutoRefresh(v => !v)}
                title="Auto-refresh every 30s"
                style={{
                  background: autoRefresh ? T.amberGlow : "none",
                  border: `1px solid ${autoRefresh ? T.amber + "40" : T.border}`,
                  color: autoRefresh ? T.amber : T.textDim,
                  fontFamily: T.mono, fontSize: 10, padding: "4px 8px", borderRadius: 4,
                }}
              >
                {autoRefresh ? "auto ↻" : "auto off"}
              </button>
              <button onClick={exportLogs} disabled={!filteredLogs.length} style={{
                background: "none", border: `1px solid ${T.border}`, color: T.textDim,
                fontFamily: T.mono, fontSize: 10, padding: "4px 8px", borderRadius: 4,
              }}>export</button>
              <button onClick={fetchLogs} style={{ background: "none", border: "none", color: T.textDim, padding: 0, fontSize: 16, lineHeight: 1 }} title="Refresh">↺</button>
            </div>
          }
        />

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>all</FilterChip>
          <FilterChip active={statusFilter === "threat"} onClick={() => setStatusFilter("threat")} color={T.red}>threat</FilterChip>
          <FilterChip active={statusFilter === "clean"} onClick={() => setStatusFilter("clean")} color={T.green}>clean</FilterChip>
          <span style={{ width: 1, height: 20, background: T.border, margin: "0 4px" }} />
          <FilterChip active={dateFilter === "all"} onClick={() => setDateFilter("all")}>all time</FilterChip>
          <FilterChip active={dateFilter === "today"} onClick={() => setDateFilter("today")}>today</FilterChip>
          <FilterChip active={dateFilter === "7d"} onClick={() => setDateFilter("7d")}>7 days</FilterChip>
          <FilterChip active={dateFilter === "30d"} onClick={() => setDateFilter("30d")}>30 days</FilterChip>
          {modes.map(m => (
            <FilterChip key={m} active={modeFilter === m} onClick={() => setModeFilter(modeFilter === m ? "all" : m)} color={T.cyan}>{m}</FilterChip>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="search subject, sender, user, id…"
          />
          <select value={sortDir} onChange={e => setSortDir(e.target.value)} style={{ width: "auto", minWidth: 130 }}>
            <option value="desc">newest first</option>
            <option value="asc">oldest first</option>
          </select>
          {(statusFilter !== "all" || modeFilter !== "all" || dateFilter !== "all" || search) && (
            <button onClick={() => { setStatusFilter("all"); setModeFilter("all"); setDateFilter("all"); setSearch(""); }} style={{
              fontFamily: T.mono, fontSize: 11, whiteSpace: "nowrap",
            }}>clear filters</button>
          )}
        </div>

        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginBottom: 12 }}>
          showing {filteredLogs.length} of {logs.length} scan{logs.length !== 1 ? "s" : ""}
        </div>

        {loading ? <Spinner /> : filteredLogs.length === 0 ? (
          <Empty msg={logs.length ? "no logs match your filters" : "no logs found in database"} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredLogs.map((log, i) => {
              const isPhish = !!log.phishing_detected;
              const open = expanded === log.id;
              const meta = getLogEmailMeta(log);
              return (
                <div key={log.id}
                  onClick={() => setExp(open ? null : log.id)}
                  style={{
                    background: open ? T.bg3 : T.bg2,
                    border: `1px solid ${open ? (isPhish ? T.red : T.green) + "60" : T.border}`,
                    borderRadius: 8, padding: "10px 14px",
                    cursor: "pointer", transition: "all .15s",
                    animation: `fadeUp .3s ${i * 0.04}s ease both`,
                    boxShadow: open ? `0 0 20px ${isPhish ? T.redDim : T.greenDim}` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: isPhish ? T.red : T.green,
                      boxShadow: `0 0 6px ${isPhish ? T.red : T.green}`,
                      animation: isPhish ? "pulse 1.5s infinite" : "none",
                    }} />
                    <Pill color={isPhish ? T.red : T.green}>{isPhish ? "THREAT" : "CLEAN"}</Pill>
                    <span style={{ fontFamily: T.mono, fontSize: 12, color: T.text }}>{log.analysis_mode}</span>
                    {log.ai_provider && log.ai_provider !== "none" && (
                      <Pill color={T.cyan}>{log.ai_provider}</Pill>
                    )}
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginLeft: "auto" }}>
                      {log.username && <span style={{ color: T.cyan, marginRight: 8 }}>{log.username}</span>}
                      #{log.id}
                    </span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span style={{ color: T.textDim, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
                  </div>

                  {(meta.subject || meta.sender) && (
                    <div style={{ marginTop: 8, paddingLeft: 18 }}>
                      {meta.subject && (
                        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.text, fontWeight: 600 }}>
                          {meta.subject}
                        </div>
                      )}
                      {meta.sender && (
                        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.textMid, marginTop: 2 }}>
                          {meta.sender}
                        </div>
                      )}
                      {meta.riskScore != null && (
                        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, marginTop: 4 }}>
                          risk score: {meta.riskScore}/100 · {meta.riskLevel}
                        </div>
                      )}
                    </div>
                  )}

                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                        {[["ai_provider", log.ai_provider], ["analysis_mode", log.analysis_mode]].map(([k, v]) => (
                          <div key={k} style={{ background: T.bg1, borderRadius: 6, padding: "8px 12px" }}>
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.cyan }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {log.raw_data && (
                        <pre style={{
                          background: T.bg0, border: `1px solid ${T.border}`,
                          borderRadius: 6, padding: 12,
                          fontFamily: T.mono, fontSize: 11, color: T.textMid,
                          overflowX: "auto", margin: 0, maxHeight: 320,
                        }}>
                          {JSON.stringify(parseLogRaw(log), null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─── Admin / approvals panel ─────────────────────────────────────────────── */
function ApprovalsPanel({ token, toast }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api("/api/organizations/pending-users", {}, token);
    setLoading(false);
    if (ok) setPending(data); else toast(data.error||"Failed","err");
  }, [token, toast]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function decide(id, action) {
    const { ok, data } = await api(`/api/organizations/${action}-user/${id}`, { method:"POST" }, token);
    if (ok) { toast(`user ${action}d`,"ok"); fetch_(); }
    else toast(data.error||"failed","err");
  }

  return (
      <Section className="fade-up">
        <SectionHead title="access requests" icon="⬡" action={
          <button onClick={fetch_} style={{ background:"none", border:"none", color:T.textDim, fontSize:16 }}>↺</button>
        } />
        {loading ? <Spinner /> : pending.length===0 ? <Empty msg="no pending requests" /> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {pending.map((u,i) => (
                  <div key={u.id} style={{
                    display:"flex", alignItems:"center", gap:14,
                    background:T.bg2, border:`1px solid ${T.border}`,
                    borderRadius:8, padding:"12px 16px",
                    animation:`fadeUp .3s ${i*0.05}s ease both`,
                  }}>
                    <div style={{
                      width:38, height:38, borderRadius:8, flexShrink:0,
                      background:T.cyanDim, border:`1px solid ${T.cyan}40`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:T.mono, fontSize:13, fontWeight:600, color:T.cyan,
                    }}>
                      {u.username.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:T.mono, fontSize:13, color:T.text }}>{u.username}</div>
                      <div style={{ fontFamily:T.mono, fontSize:11, color:T.textDim, marginTop:2 }}>
                        requested {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button onClick={() => decide(u.id,"approve")} style={{
                      background:T.greenDim, border:`1px solid ${T.green}60`,
                      color:T.green, fontFamily:T.mono, fontSize:12,
                      padding:"7px 14px", borderRadius:6,
                    }}>✓ approve</button>
                    <button onClick={() => decide(u.id,"reject")} style={{
                      background:T.redDim, border:`1px solid ${T.red}60`,
                      color:T.red, fontFamily:T.mono, fontSize:12,
                      padding:"7px 14px", borderRadius:6,
                    }}>✗ reject</button>
                  </div>
              ))}
            </div>
        )}
      </Section>
  );
}

/* ─── Organizations panel ─────────────────────────────────────────────────── */
function OrgsPanel({ toast }) {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoad] = useState(true);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoad(true);
    const { data } = await api("/api/organizations");
    setLoad(false);
    if (Array.isArray(data)) setOrgs(data);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function create(e) {
    e.preventDefault(); setBusy(true);
    const { ok, data } = await api("/api/organizations", { method:"POST", body:JSON.stringify({ name:newName }) });
    setBusy(false);
    if (ok) { toast(`"${newName}" deployed`, "ok"); setNewName(""); fetch_(); }
    else toast(data.error||"Failed","err");
  }

  return (
      <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:"1.25rem", alignItems:"start" }}>
        <Section className="fade-up">
          <SectionHead title="deploy org" icon="⬡" />
          <form onSubmit={create}>
            <div style={{ marginBottom:12 }}>
              <FieldLabel>organization name</FieldLabel>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="AcmeCorp" required />
            </div>
            <div style={{ padding:"9px 12px", marginBottom:12, background:T.bg3, border:`1px solid ${T.amberDim}`, borderRadius:6, fontFamily:T.mono, fontSize:11, color:T.amber, lineHeight:1.7 }}>
              ⚠ auto-creates admin:<br/><strong>{newName||"orgName"}Admin</strong> / admin
            </div>
            <SubmitBtn loading={busy}>[ deploy → ]</SubmitBtn>
          </form>
        </Section>

        <Section className="fade-up-1">
          <SectionHead title="registered orgs" icon="◈" action={
            <button onClick={fetch_} style={{ background:"none", border:"none", color:T.textDim, fontSize:16 }}>↺</button>
          } />
          {loading ? <Spinner /> : orgs.length===0 ? <Empty msg="no organizations registered" /> : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:10 }}>
                {orgs.map((o,i) => (
                    <div key={o.id} style={{
                      background:T.bg2, border:`1px solid ${T.border}`,
                      borderRadius:8, padding:"12px 14px",
                      animation:`fadeUp .3s ${i*0.05}s ease both`,
                      transition:"border-color .15s",
                    }}
                         onMouseEnter={e=>e.currentTarget.style.borderColor=T.amber+"50"}
                         onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}
                    >
                      <div style={{ fontFamily:T.mono, fontSize:18, marginBottom:6, color:T.amber }}>⬡</div>
                      <div style={{ fontFamily:T.mono, fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{o.name}</div>
                      <div style={{ fontFamily:T.mono, fontSize:11, color:T.textDim }}>id:{o.id} · {new Date(o.created_at).toLocaleDateString()}</div>
                    </div>
                ))}
              </div>
          )}
        </Section>
      </div>
  );
}

/* ─── App shell ───────────────────────────────────────────────────────────── */
export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("sl_tok")||null);
  const [user,  setUser]  = useState(() => { const t=sessionStorage.getItem("sl_tok"); return t?parseJwt(t):null; });
  const [tab,   setTab]   = useState("logs");
  const [toast, setToast] = useState(null);

  function doToast(msg, type="ok") { setToast({ msg, type, id:Date.now() }); }

  function login(tok) {
    sessionStorage.setItem("sl_tok", tok);
    setToken(tok); setUser(parseJwt(tok));
  }

  function logout() {
    sessionStorage.removeItem("sl_tok");
    setToken(null); setUser(null); setTab("logs");
  }

  const isAdmin = user?.role==="admin";

  const navItems = [
    { key:"logs",       label:"feed",      icon:"◈" },
    { key:"analytics",  label:"analytics", icon:"◫" },
    ...(isAdmin ? [{ key:"approvals", label:"requests",  icon:"⬡" }] : []),
    { key:"orgs",       label:"orgs",      icon:"⬢" },
  ];

  if (!token) return (
      <>
        <style>{G.fonts}{G.base}</style>
        <AuthScreen onLogin={login} toast={doToast} />
        {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
      </>
  );

  return (
      <div style={{ minHeight:"100vh", background:T.bg0, display:"flex" }}>
        <style>{G.fonts}{G.base}</style>

        {/* Sidebar */}
        <div style={{
          width:220, flexShrink:0, background:T.bg1,
          borderRight:`1px solid ${T.border}`,
          display:"flex", flexDirection:"column",
          position:"sticky", top:0, height:"100vh",
          overflow:"hidden",
        }}>
          {/* Logo */}
          <div style={{ padding:"1.5rem 1.25rem 1.25rem", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:T.mono, fontSize:15, fontWeight:700, letterSpacing:"0.08em", color:T.amber }}>
              SENTRY<span style={{ color:T.text }}>_</span>LOG
            </div>
            <div style={{ fontFamily:T.mono, fontSize:10, color:T.textDim, marginTop:3, letterSpacing:"0.1em" }}>
              THREAT INTELLIGENCE
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding:"1rem 0.75rem", flex:1 }}>
            {navItems.map(n => (
                <button key={n.key} onClick={()=>setTab(n.key)} style={{
                  display:"flex", alignItems:"center", gap:10,
                  width:"100%", textAlign:"left",
                  background: tab===n.key ? T.amberGlow : "none",
                  border: tab===n.key ? `1px solid ${T.amber}30` : "1px solid transparent",
                  color: tab===n.key ? T.amber : T.textDim,
                  fontFamily:T.mono, fontSize:12, fontWeight:600,
                  letterSpacing:"0.08em", textTransform:"uppercase",
                  padding:"9px 12px", borderRadius:7, marginBottom:3,
                  transition:"all .15s",
                }}>
                  <span style={{ fontSize:14 }}>{n.icon}</span>
                  {n.label}
                  {tab===n.key && <span style={{ marginLeft:"auto", width:5, height:5, borderRadius:"50%", background:T.amber, boxShadow:`0 0 6px ${T.amber}` }} />}
                </button>
            ))}
          </nav>

          {/* User info */}
          <div style={{ borderTop:`1px solid ${T.border}`, padding:"1rem 1.25rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{
                width:34, height:34, borderRadius:8, flexShrink:0,
                background:T.amberGlow, border:`1px solid ${T.amberDim}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:T.mono, fontSize:12, fontWeight:700, color:T.amber,
              }}>
                {user?.username?.slice(0,2).toUpperCase()}
              </div>
              <div style={{ overflow:"hidden" }}>
                <div style={{ fontFamily:T.mono, fontSize:12, color:T.text, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user?.username}</div>
                <div style={{ fontFamily:T.mono, fontSize:10, color:T.textDim, marginTop:2 }}>
                  {isAdmin ? "admin" : "operator"}
                  {user?.org_status==="approved" ? " · active" : user?.org_status==="pending" ? " · pending" : ""}
                </div>
              </div>
            </div>
            <button onClick={logout} style={{
              width:"100%", fontFamily:T.mono, fontSize:11, fontWeight:600,
              letterSpacing:"0.08em", textTransform:"uppercase",
              color:T.textDim, padding:"7px",
            }}>
              [ sign out ]
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex:1, padding:"1.75rem", overflowY:"auto", maxWidth:"calc(100vw - 220px)" }}>
          {/* Header bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.75rem" }}>
            <div>
              <div style={{ fontFamily:T.mono, fontSize:12, color:T.textDim, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
                ▸ {navItems.find(n=>n.key===tab)?.label}
              </div>
              <h1 style={{ fontFamily:T.mono, fontSize:18, fontWeight:600, color:T.text, letterSpacing:"0.02em" }}>
                {tab==="logs" && (isAdmin ? "organization threat feed" : "my threat feed")}
                {tab==="analytics" && "scan analytics & charts"}
                {tab==="approvals" && "pending access requests"}
                {tab==="orgs" && "organization registry"}
              </h1>
            </div>

            {/* Status bar */}
            <div style={{ display:"flex", alignItems:"center", gap:16, fontFamily:T.mono, fontSize:11, color:T.textDim }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:T.green, boxShadow:`0 0 5px ${T.green}` }} />
                system online
              </div>
              {user?.org_status==="pending" && (
                  <Pill color={T.amber}>approval pending</Pill>
              )}
              {isAdmin && <Pill color={T.cyan}>admin</Pill>}
            </div>
          </div>

          {tab==="logs"       && <LogsPanel       token={token} user={user} toast={doToast} />}
          {tab==="analytics"  && <AnalyticsPanel  token={token}             toast={doToast} />}
          {tab==="approvals"  && <ApprovalsPanel  token={token}             toast={doToast} />}
          {tab==="orgs"      && <OrgsPanel                               toast={doToast} />}
        </div>

        {toast && <Toast key={toast.id} msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
      </div>
  );
}
