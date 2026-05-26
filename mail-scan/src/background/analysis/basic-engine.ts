import type { EmailData, BasicAnalysisResult, AnalysisFlag } from "@shared/types";
import { RISK_THRESHOLDS } from "@shared/constants";
import {
  extractUrls,
  checkLinkMismatch,
  checkSuspiciousTLDs,
  checkIPUrls,
  checkHomoglyphs,
  checkShortenedUrls,
} from "./url-checker";

const URGENCY_KEYWORDS = [
  "immediately",
  "urgent",
  "suspend",
  "verify your account",
  "confirm your identity",
  "unauthorized",
  "locked",
  "expire",
  "act now",
  "limited time",
  "click here",
  "update your payment",
  "your account has been",
];

const WEIGHTS = {
  linkMismatch: 30,
  suspiciousTld: 15,
  ipUrl: 20,
  homoglyph: 25,
  urgencyKeyword: 10,
  urgencyMax: 30,
  grammarFlags: 10,
  senderMismatch: 20,
  missingSender: 15,
  attachmentBait: 10,
} as const;

function checkUrgencyKeywords(bodyText: string): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const lower = bodyText.toLowerCase();

  for (const keyword of URGENCY_KEYWORDS) {
    if (lower.includes(keyword)) {
      flags.push({
        type: "urgency",
        message: `Urgency keyword detected: "${keyword}"`,
        severity: "medium",
      });
    }
  }

  return flags;
}

function checkGrammarFlags(bodyText: string): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];

  const capsRatio =
    bodyText.replace(/[^A-Za-z]/g, "").length > 0
      ? (bodyText.replace(/[^A-Z]/g, "").length /
          bodyText.replace(/[^A-Za-z]/g, "").length) *
        100
      : 0;

  if (capsRatio > 40 && bodyText.length > 50) {
    flags.push({
      type: "grammar",
      message: "Excessive use of capital letters",
      severity: "low",
    });
  }

  const exclamationCount = (bodyText.match(/!{2,}/g) || []).length;
  if (exclamationCount >= 2) {
    flags.push({
      type: "grammar",
      message: "Excessive exclamation marks detected",
      severity: "low",
    });
  }

  return flags;
}

function checkSenderMismatch(email: EmailData): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  if (!email.senderEmail) return flags;

  const senderDomain = email.senderEmail.split("@")[1]?.toLowerCase() ?? "";
  const bodyLower = email.bodyText.toLowerCase();

  const brandPatterns: [string, string[]][] = [
    ["paypal", ["paypal.com"]],
    ["microsoft", ["microsoft.com", "outlook.com", "live.com"]],
    ["apple", ["apple.com", "icloud.com"]],
    ["google", ["google.com", "gmail.com"]],
    ["amazon", ["amazon.com", "amazon.co"]],
    ["netflix", ["netflix.com"]],
    ["bank of america", ["bankofamerica.com"]],
  ];

  for (const [brand, domains] of brandPatterns) {
    if (bodyLower.includes(brand) && !domains.some((d) => senderDomain.includes(d))) {
      flags.push({
        type: "sender_mismatch",
        message: `Email mentions "${brand}" but sender domain is "${senderDomain}"`,
        severity: "high",
      });
      break;
    }
  }

  return flags;
}

function checkMissingSender(email: EmailData): AnalysisFlag[] {
  if (email.senderEmail) return [];
  return [
    {
      type: "missing_sender",
      message: "Sender email address could not be verified",
      severity: "medium",
    },
  ];
}

function checkAttachmentBait(bodyText: string): AnalysisFlag[] {
  const lower = bodyText.toLowerCase();
  const phrases = [
    "open the attachment",
    "see attached",
    "download the file",
    "invoice attached",
    "wire transfer",
    "payment required",
  ];

  for (const phrase of phrases) {
    if (lower.includes(phrase)) {
      return [
        {
          type: "attachment_bait",
          message: `Potential attachment bait: "${phrase}"`,
          severity: "medium",
        },
      ];
    }
  }

  return [];
}

function computeScore(flags: AnalysisFlag[]): number {
  let score = 0;
  let urgencyPoints = 0;

  for (const flag of flags) {
    switch (flag.type) {
      case "link_mismatch":
        score += WEIGHTS.linkMismatch;
        break;
      case "suspicious_tld":
        score += WEIGHTS.suspiciousTld;
        break;
      case "ip_url":
        score += WEIGHTS.ipUrl;
        break;
      case "homoglyph":
        score += WEIGHTS.homoglyph;
        break;
      case "urgency":
        urgencyPoints += WEIGHTS.urgencyKeyword;
        break;
      case "grammar":
        score += WEIGHTS.grammarFlags;
        break;
      case "sender_mismatch":
        score += WEIGHTS.senderMismatch;
        break;
      case "missing_sender":
        score += WEIGHTS.missingSender;
        break;
      case "shortened_url":
        score += 12;
        break;
      case "attachment_bait":
        score += WEIGHTS.attachmentBait;
        break;
    }
  }

  score += Math.min(urgencyPoints, WEIGHTS.urgencyMax);
  return Math.min(score, 100);
}

export function runBasicAnalysis(email: EmailData): BasicAnalysisResult {
  const allUrls = [
    ...extractUrls(email.bodyText),
    ...email.links.map((l) => l.href),
  ];
  const uniqueUrls = [...new Set(allUrls)];

  const flags: AnalysisFlag[] = [
    ...checkLinkMismatch(email.links),
    ...checkSuspiciousTLDs(uniqueUrls),
    ...checkIPUrls(uniqueUrls),
    ...checkHomoglyphs(uniqueUrls),
    ...checkShortenedUrls(uniqueUrls),
    ...checkUrgencyKeywords(email.bodyText),
    ...checkGrammarFlags(email.bodyText),
    ...checkSenderMismatch(email),
    ...checkMissingSender(email),
    ...checkAttachmentBait(email.bodyText),
  ];

  const score = computeScore(flags);
  const riskLevel =
    score <= RISK_THRESHOLDS.LOW_MAX
      ? "low"
      : score <= RISK_THRESHOLDS.MEDIUM_MAX
        ? "medium"
        : "high";

  return { score, riskLevel, flags };
}
