import { useState, useEffect } from "react";
import type { AIProvider } from "@shared/types";
import { sendMessage } from "@shared/messaging";
import { MSG, SECRET_KEYS } from "@shared/constants";

interface Props {
  provider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
}

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "gemini", label: "Gemini" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "claude", label: "Claude" },
  { value: "custom", label: "Custom" },
];

export default function AIProviderConfig({
  provider,
  onProviderChange,
}: Props) {
  const [apiKey, setApiKey] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    sendMessage(MSG.GET_SECRET, { key: SECRET_KEYS.AI_API_KEY }).then((res) => {
      if (res.value) setApiKey(res.value);
      else setApiKey("");
    });
    sendMessage(MSG.GET_SECRET, { key: SECRET_KEYS.CUSTOM_AI_ENDPOINT }).then(
      (res) => {
        if (res.value) setCustomEndpoint(res.value);
        else setCustomEndpoint("");
      },
    );
  }, [provider]);

  async function handleSave() {
    await sendMessage(MSG.SAVE_SECRET, {
      key: SECRET_KEYS.AI_API_KEY,
      value: apiKey,
    });
    if (provider === "custom" && customEndpoint) {
      await sendMessage(MSG.SAVE_SECRET, {
        key: SECRET_KEYS.CUSTOM_AI_ENDPOINT,
        value: customEndpoint,
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="card">
      <div className="card-title">AI Provider</div>
      <div className="radio-group">
        {PROVIDERS.map((p) => (
          <label key={p.value}>
            <input
              type="radio"
              name="ai-provider"
              value={p.value}
              checked={provider === p.value}
              onChange={() => onProviderChange(p.value)}
            />
            {p.label}
          </label>
        ))}
      </div>
      <div className="form-group" style={{ marginTop: 8 }}>
        <label>API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
        />
      </div>
      {provider === "custom" && (
        <div className="form-group">
          <label>Custom Endpoint URL</label>
          <input
            type="url"
            value={customEndpoint}
            onChange={(e) => setCustomEndpoint(e.target.value)}
            placeholder="https://your-api.example.com/analyze"
          />
        </div>
      )}
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={!apiKey}
      >
        {saved ? "Saved" : "Save Credentials"}
      </button>
    </div>
  );
}
