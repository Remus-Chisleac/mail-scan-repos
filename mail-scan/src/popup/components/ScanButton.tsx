import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";
import type { AnalysisMode, AIProvider, AnalysisResult } from "@shared/types";

interface Props {
  mode: AnalysisMode;
  provider: AIProvider;
  scanning: boolean;
  onScanStart: () => void;
  onScanComplete: (result: AnalysisResult) => void;
  onScanError: (error: string) => void;
}

export default function ScanButton({
  mode,
  provider,
  scanning,
  onScanStart,
  onScanComplete,
  onScanError,
}: Props) {
  async function handleScan() {
    onScanStart();
    try {
      const res = await sendMessage(MSG.SCAN_EMAIL, { mode, provider });
      if (res.success && res.result) {
        onScanComplete(res.result);
      } else {
        onScanError(res.error ?? "Scan failed.");
      }
    } catch (err) {
      onScanError(err instanceof Error ? err.message : "Scan failed.");
    }
  }

  return (
    <>
      <p className="hint" style={{ marginBottom: 8 }}>
        Open a message in Gmail or Outlook, then scan the visible email.
      </p>
      <button
      className="btn btn-primary btn-block"
      onClick={handleScan}
      disabled={scanning}
    >
      {scanning ? (
        <>
          <span className="spinner" /> Scanning...
        </>
      ) : (
        "Scan Current Email"
      )}
    </button>
    </>
  );
}
