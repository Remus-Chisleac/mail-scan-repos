import { useState, useEffect } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG, SECRET_KEYS, DEFAULT_SENTRY_LOG_SERVER } from "@shared/constants";

interface Props {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function LoggingConfig({ enabled, onToggle }: Props) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SENTRY_LOG_SERVER);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [connectedAs, setConnectedAs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setSaved(false);
    setError(null);

    sendMessage(MSG.GET_SECRET, { key: SECRET_KEYS.SENTRY_LOG_SERVER }).then(
      (res) => {
        if (res.value) setServerUrl(res.value);
      },
    );
    sendMessage(MSG.GET_SECRET, { key: SECRET_KEYS.SENTRY_LOG_USERNAME }).then(
      (res) => {
        if (res.value) setUsername(res.value);
      },
    );
    sendMessage(MSG.SENTRY_LOG_STATUS, {}).then((res) => {
      setConnectedAs(res.connected ? (res.username ?? null) : null);
    });
  }, [enabled]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      await sendMessage(MSG.SAVE_SECRET, {
        key: SECRET_KEYS.SENTRY_LOG_SERVER,
        value: serverUrl,
      });
      await sendMessage(MSG.SAVE_SECRET, {
        key: SECRET_KEYS.SENTRY_LOG_USERNAME,
        value: username,
      });
      await sendMessage(MSG.SAVE_SECRET, {
        key: SECRET_KEYS.SENTRY_LOG_PASSWORD,
        value: password,
      });

      const result = await sendMessage(MSG.SENTRY_LOG_LOGIN, {});
      if (!result.success) {
        throw new Error(result.error ?? "Failed to connect to SENTRY_LOG");
      }

      setConnectedAs(result.username ?? username);
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setConnectedAs(null);
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="toggle-row">
        <span className="card-title" style={{ marginBottom: 0 }}>
          SENTRY_LOG Server
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>
      {enabled && (
        <>
          <p className="hint" style={{ marginTop: 8, marginBottom: 12 }}>
            Send scan results to the SENTRY_LOG backend at{" "}
            <code>/api/logs</code>.
          </p>
          <div className="form-group">
            <label>Server URL</label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder={DEFAULT_SENTRY_LOG_SERVER}
            />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your SENTRY_LOG username"
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                connectedAs ? "leave blank to keep saved password" : "password"
              }
              autoComplete="current-password"
            />
          </div>
          {connectedAs && (
            <p className="hint" style={{ marginBottom: 12 }}>
              Connected as <strong>{connectedAs}</strong>
            </p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={busy || !serverUrl || !username}
          >
            {busy ? "Connecting…" : saved ? "Connected" : "Connect to Server"}
          </button>
        </>
      )}
    </div>
  );
}
