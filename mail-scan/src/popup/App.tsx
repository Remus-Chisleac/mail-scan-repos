import { useState, useEffect } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";
import MasterPasswordSetup from "./components/MasterPasswordSetup";
import MasterPasswordUnlock from "./components/MasterPasswordUnlock";
import Dashboard from "./components/Dashboard";

type Screen = "loading" | "setup" | "unlock" | "dashboard";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");

  useEffect(() => {
    console.log("[Mail Scan Popup] Checking vault state...");
    sendMessage(MSG.CHECK_VAULT, {})
      .then((res) => {
        console.log("[Mail Scan Popup] Vault state:", res);
        if (!res.initialized) setScreen("setup");
        else if (!res.unlocked) setScreen("unlock");
        else setScreen("dashboard");
      })
      .catch((err) => {
        console.error("[Mail Scan Popup] Failed to check vault:", err);
        setScreen("setup");
      });
  }, []);

  if (screen === "loading") {
    return (
      <div className="password-screen">
        <span className="spinner" />
      </div>
    );
  }

  if (screen === "setup") {
    return <MasterPasswordSetup onComplete={() => setScreen("dashboard")} />;
  }

  if (screen === "unlock") {
    return <MasterPasswordUnlock onUnlock={() => setScreen("dashboard")} />;
  }

  return <Dashboard onLock={() => setScreen("unlock")} />;
}
