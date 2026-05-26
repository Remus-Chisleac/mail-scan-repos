export type RiskLevel = "low" | "medium" | "high";

export type AnalysisMode = "basic" | "advanced";

export type AIProvider = "gemini" | "chatgpt" | "claude" | "custom";

export interface EmailLink {
  text: string;
  href: string;
}

export interface EmailData {
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyText: string;
  links: EmailLink[];
}

export interface AnalysisFlag {
  type: string;
  message: string;
  severity: RiskLevel;
}

export interface BasicAnalysisResult {
  score: number;
  riskLevel: RiskLevel;
  flags: AnalysisFlag[];
}

export interface AIAnalysisResult {
  risk: RiskLevel;
  confidence: number;
  reasons: string[];
  recommendation: string;
  rawResponse?: string;
}

export interface AnalysisResult {
  timestamp: string;
  emailMeta: {
    sender: string;
    subject: string;
  };
  basicAnalysis: BasicAnalysisResult;
  aiAnalysis?: AIAnalysisResult;
}

export interface LogPayload {
  timestamp: string;
  emailMeta: {
    sender: string;
    subject: string;
  };
  basicAnalysis: BasicAnalysisResult;
  aiAnalysis?: AIAnalysisResult;
  extensionVersion: string;
}

export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

export interface UserSettings {
  analysisMode: AnalysisMode;
  aiProvider: AIProvider;
  loggingEnabled: boolean;
  customAiEndpoint?: string;
  loggingEndpoint?: string;
}

export interface VaultMeta {
  salt: string;
  passwordHash: string;
}
