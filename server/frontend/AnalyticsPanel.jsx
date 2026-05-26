import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line,
} from "recharts";

const API_BASE = "http://localhost:8080";

const C = {
  bg1: "#0d1320",
  bg2: "#111a2e",
  border: "#1e2d4a",
  amber: "#f5a623",
  cyan: "#38bdf8",
  green: "#4ade80",
  red: "#f87171",
  text: "#e2eaf8",
  textMid: "#8da3c4",
  textDim: "#4a6080",
  mono: "'JetBrains Mono', 'Fira Mono', monospace",
  palette: ["#f5a623", "#38bdf8", "#4ade80", "#f87171", "#a78bfa", "#fb923c", "#2dd4bf"],
};

async function api(path, token) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, data: d };
}

function parseLogRaw(log) {
  try {
    return typeof log.raw_data === "string" ? JSON.parse(log.raw_data) : (log.raw_data || {});
  } catch {
    return {};
  }
}

function countBy(items, keyFn) {
  const map = {};
  items.forEach(item => {
    const k = keyFn(item) || "unknown";
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function aggregateLogs(logs) {
  const threatSplit = [
    { name: "clean", value: logs.filter(l => !l.phishing_detected).length, fill: C.green },
    { name: "threat", value: logs.filter(l => l.phishing_detected).length, fill: C.red },
  ];

  const providers = countBy(logs, l => l.ai_provider || "none").map((d, i) => ({
    ...d,
    fill: C.palette[i % C.palette.length],
  }));

  const methods = countBy(logs, l => l.analysis_mode || "unknown").map((d, i) => ({
    ...d,
    fill: C.palette[i % C.palette.length],
  }));

  const riskLevels = countBy(logs, l => {
    const raw = parseLogRaw(l);
    return raw.basicAnalysis?.riskLevel || "unknown";
  }).map((d, i) => ({
    ...d,
    fill: d.name === "high" ? C.red : d.name === "medium" ? C.amber : d.name === "low" ? C.green : C.palette[i % C.palette.length],
  }));

  const byDayMap = {};
  logs.forEach(log => {
    const day = new Date(log.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!byDayMap[day]) byDayMap[day] = { day, scans: 0, threats: 0, clean: 0 };
    byDayMap[day].scans += 1;
    if (log.phishing_detected) byDayMap[day].threats += 1;
    else byDayMap[day].clean += 1;
  });
  const timeline = Object.values(byDayMap).slice(-14);

  const operators = countBy(logs, l => l.username || "unknown").slice(0, 8);

  const hourlyMap = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, scans: 0 }));
  logs.forEach(log => {
    const h = new Date(log.timestamp).getHours();
    hourlyMap[h].scans += 1;
  });

  const threatRate = logs.length
    ? Math.round((logs.filter(l => l.phishing_detected).length / logs.length) * 100)
    : 0;

  return { threatSplit, providers, methods, riskLevels, timeline, operators, hourlyMap, threatRate };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "10px 12px", fontFamily: C.mono, fontSize: 12,
    }}>
      {label && <div style={{ color: C.textDim, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color || C.text }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={className} style={{
      background: C.bg1, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "1.25rem", minHeight: 280,
    }}>
      <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.amber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim, marginBottom: 16 }}>{subtitle}</div>
      )}
      {!subtitle && <div style={{ marginBottom: 16 }} />}
      {children}
    </div>
  );
}

function EmptyChart({ msg }) {
  return (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontFamily: C.mono, fontSize: 12 }}>
      {msg}
    </div>
  );
}

const axisStyle = { fill: C.textDim, fontSize: 11, fontFamily: C.mono };
const gridStroke = C.border;

export default function AnalyticsPanel({ token, toast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await api("/api/logs", token);
    setLoading(false);
    if (ok) setLogs(Array.isArray(data) ? data : []);
    else toast(data.error || "Failed to load analytics", "err");
  }, [token, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const data = useMemo(() => aggregateLogs(logs), [logs]);
  const hasData = logs.length > 0;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "4rem", color: C.textDim, fontFamily: C.mono }}>
        loading analytics…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "total scans", value: logs.length, color: C.cyan },
          { label: "threat rate", value: `${data.threatRate}%`, color: C.red },
          { label: "providers used", value: data.providers.filter(p => p.name !== "none").length, color: C.amber },
          { label: "scan methods", value: data.methods.length, color: C.green },
        ].map(s => (
          <div key={s.label} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
            <div style={{ fontFamily: C.mono, fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        <ChartCard title="threat breakdown" subtitle="clean vs flagged emails" className="fade-up">
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.threatSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {data.threatSplit.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontFamily: C.mono, fontSize: 11, color: C.textMid }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="no scan data yet" />}
        </ChartCard>

        <ChartCard title="scan methods" subtitle="basic vs advanced analysis" className="fade-up-1">
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.methods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} stroke="none">
                  {data.methods.map((entry, i) => (
                    <Cell key={entry.name} fill={entry.fill || C.palette[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontFamily: C.mono, fontSize: 11, color: C.textMid }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="no scan data yet" />}
        </ChartCard>

        <ChartCard title="risk levels" subtitle="heuristic score distribution" className="fade-up-2">
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.riskLevels} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.riskLevels.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="no scan data yet" />}
        </ChartCard>
      </div>

      <ChartCard title="ai providers" subtitle="usage by provider" className="fade-up">
        {hasData ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.providers} margin={{ bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.providers.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill || C.palette[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart msg="no scan data yet" />}
      </ChartCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.25rem" }}>
        <ChartCard title="scan timeline" subtitle="last 14 days — volume & threats" className="fade-up-1">
          {data.timeline.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontFamily: C.mono, fontSize: 11 }} />
                <Area type="monotone" dataKey="scans" stackId="1" stroke={C.cyan} fill={`${C.cyan}33`} name="total scans" />
                <Area type="monotone" dataKey="threats" stackId="2" stroke={C.red} fill={`${C.red}33`} name="threats" />
                <Line type="monotone" dataKey="clean" stroke={C.green} dot={false} name="clean" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="not enough timeline data" />}
        </ChartCard>

        <ChartCard title="activity by hour" subtitle="when scans happen (UTC local)" className="fade-up-2">
          {hasData ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.hourlyMap.filter((_, i) => i % 2 === 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="hour" tick={axisStyle} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="scans" fill={C.amber} radius={[3, 3, 0, 0]} name="scans" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="no scan data yet" />}
        </ChartCard>
      </div>

      <ChartCard title="top operators" subtitle="scans per user" className="fade-up-3">
        {data.operators.length ? (
          <ResponsiveContainer width="100%" height={Math.max(200, data.operators.length * 36)}>
            <BarChart data={data.operators} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="value" fill={C.cyan} radius={[0, 4, 4, 0]} name="scans" />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart msg="no operator data yet" />}
      </ChartCard>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={fetchLogs} style={{
          fontFamily: C.mono, fontSize: 12, color: C.textDim,
          background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 14px",
        }}>
          ↺ refresh analytics
        </button>
      </div>
    </div>
  );
}
