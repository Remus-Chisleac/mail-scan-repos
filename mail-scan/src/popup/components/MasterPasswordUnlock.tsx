import { useState } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";

interface Props {
  onUnlock: () => void;
}

export default function MasterPasswordUnlock({ onUnlock }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await sendMessage(MSG.UNLOCK_VAULT, { password });
      if (res.success) {
        onUnlock();
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Failed to unlock vault.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="password-screen">
      <h2>Mail Scan</h2>
      <p>Enter your master password to unlock.</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Master Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!password || loading}
        >
          {loading ? <span className="spinner" /> : "Unlock"}
        </button>
      </form>
    </div>
  );
}
