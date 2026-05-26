import { useState } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";

interface Props {
  onComplete: () => void;
}

export default function MasterPasswordSetup({ onComplete }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = password.length >= 8 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendMessage(MSG.INIT_VAULT, { password });
      if (res.success) {
        onComplete();
      } else {
        setError("Failed to initialize vault.");
      }
    } catch {
      setError("Failed to initialize vault.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="password-screen">
      <h2>Mail Scan</h2>
      <p>Set a master password to encrypt your API keys and sensitive data.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Master Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!isValid || loading}
        >
          {loading ? <span className="spinner" /> : "Set Password & Continue"}
        </button>
      </form>
    </div>
  );
}
