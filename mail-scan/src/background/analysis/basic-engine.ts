import type {
  EmailData,
  BasicAnalysisResult,
  AnalysisFlag,
  RiskLevel,
} from "@shared/types";
import { RISK_THRESHOLDS, KNOWN_BRANDS } from "@shared/constants";
import { checkDomainAge } from "./domain-age";
import {
  extractUrls,
  checkLinkMismatch,
  checkSuspiciousTLDs,
  checkIPUrls,
  checkHomoglyphs,
  checkShortenedUrls,
  checkPunycode,
  checkLookalikeDomains,
} from "./url-checker";

const URGENCY_KEYWORDS = [
  "immediately",
  "urgent",
  "as soon as possible",
  "right away",
  "suspend",
  "suspended",
  "verify your account",
  "verify your identity",
  "confirm your identity",
  "confirm your account",
  "unauthorized",
  "locked",
  "deactivat",
  "expire",
  "expires",
  "act now",
  "action required",
  "final notice",
  "limited time",
  "within 24 hours",
  "within 48 hours",
  "click here",
  "click below",
  "update your payment",
  "your account has been",
  "failure to",
  "avoid suspension",
];

const CREDENTIAL_PHRASES = [
  "verify your password",
  "confirm your password",
  "enter your password",
  "update your password",
  "your password",
  "login credentials",
  "log in to verify",
  "sign in to verify",
  "confirm your account details",
  "update your billing",
  "billing information",
  "payment details",
  "credit card number",
  "card number",
  "social security",
  "ssn",
  "one-time password",
  "otp",
  "security code",
  "pin number",
];

const FINANCIAL_LURE_PHRASES = [
  "you have won",
  "you've won",
  "lottery",
  "prize",
  "claim your reward",
  "claim your prize",
  "inheritance",
  "gift card",
  "tax refund",
  "refund of",
  "you are eligible",
  "congratulations you",
  "cash bonus",
  "bitcoin",
  "wire transfer",
];

const ATTACHMENT_PHRASES = [
  "open the attachment",
  "see attached",
  "download the file",
  "invoice attached",
  "view the document",
  "scan the qr",
];

const GENERIC_GREETINGS = [
  "dear customer",
  "dear user",
  "dear valued customer",
  "dear account holder",
  "dear member",
  "dear client",
  "dear sir/madam",
  "dear sir or madam",
  "attention user",
  "valued customer",
];

/**
 * Probability (0..1) each *distinct* signal type contributes to the phishing
 * likelihood. Types are combined with a noisy-OR (see {@link computeScore}).
 *
 * Weighting is deliberately tiered: structural URL/sender signals (a hidden
 * link, a raw IP, a brand look-alike) are strong, near-decisive evidence, while
 * text-tone signals (urgency words, generic greetings, grammar) are weak
 * corroboration. This keeps a chatty-but-legitimate newsletter ("act now!
 * limited time!") well below a quietly-worded email that hides a spoofed link.
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  // Structural / URL — strong, hard for legitimate mail to trip.
  link_mismatch: 0.7,
  ip_url: 0.65,
  punycode: 0.6,
  lookalike_domain: 0.6,
  homoglyph: 0.55,
  sender_mismatch: 0.55,
  // Domain age — a freshly-registered domain is strong evidence; merely young
  // is moderate (legit new businesses exist).
  new_domain: 0.6,
  young_domain: 0.3,
  // URL hygiene — moderate; common in legit bulk mail too.
  suspicious_tld: 0.25,
  shortened_url: 0.15,
  // Content / tone — weak corroboration only.
  credential_request: 0.4,
  financial_lure: 0.28,
  attachment_bait: 0.15,
  urgency: 0.1,
  generic_greeting: 0.07,
  grammar: 0.06,
  // Extraction artifact, not a phishing signal — kept visible but near-zero
  // weight so a failed sender parse no longer swings the score.
  missing_sender: 0.04,
};

/**
 * How much each additional hit of the *same* signal type may add, as a fraction
 * of that type's base weight. Repeats give diminishing, capped returns so an
 * email crammed with ten urgency phrases scores like one strong urgency cue —
 * not ten — which is the main source of the old engine's volatility.
 */
const REPEAT_BONUS_PER_HIT = 0.25;
const REPEAT_BONUS_CAP = 0.5;

const SEVERITY_WEIGHTS: Record<RiskLevel, number> = {
  high: 0.5,
  medium: 0.2,
  low: 0.1,
};

// Cap matches reported per keyword category. The score already applies
// diminishing returns per type, and the UI only shows a handful of flags, so
// surfacing every matched phrase just buries the distinct signals.
const MAX_KEYWORD_HITS_PER_TYPE = 3;

function keywordFlags(
  text: string,
  keywords: string[],
  type: string,
  severity: RiskLevel,
  describe: (keyword: string) => string,
  limit = MAX_KEYWORD_HITS_PER_TYPE,
): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const lower = text.toLowerCase();
  const seen = new Set<string>();

  for (const keyword of keywords) {
    if (flags.length >= limit) break;
    if (lower.includes(keyword) && !seen.has(keyword)) {
      seen.add(keyword);
      flags.push({ type, message: describe(keyword), severity });
    }
  }

  return flags;
}

function checkUrgencyKeywords(text: string): AnalysisFlag[] {
  return keywordFlags(
    text,
    URGENCY_KEYWORDS,
    "urgency",
    "medium",
    (k) => `Urgency/pressure language detected: "${k}"`,
  );
}

function checkCredentialRequests(text: string): AnalysisFlag[] {
  return keywordFlags(
    text,
    CREDENTIAL_PHRASES,
    "credential_request",
    "high",
    (k) => `Requests sensitive credentials: "${k}"`,
  );
}

function checkFinancialLures(text: string): AnalysisFlag[] {
  return keywordFlags(
    text,
    FINANCIAL_LURE_PHRASES,
    "financial_lure",
    "medium",
    (k) => `Financial lure / reward bait: "${k}"`,
  );
}

function checkGenericGreeting(bodyText: string): AnalysisFlag[] {
  const opening = bodyText.slice(0, 200).toLowerCase();
  for (const greeting of GENERIC_GREETINGS) {
    if (opening.includes(greeting)) {
      return [
        {
          type: "generic_greeting",
          message: `Impersonal greeting: "${greeting}"`,
          severity: "low",
        },
      ];
    }
  }
  return [];
}

function checkGrammarFlags(bodyText: string): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];

  const letters = bodyText.replace(/[^A-Za-z]/g, "").length;
  const capsRatio =
    letters > 0
      ? (bodyText.replace(/[^A-Z]/g, "").length / letters) * 100
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
  const haystack = `${email.subject} ${email.bodyText}`.toLowerCase();

  for (const brand of KNOWN_BRANDS) {
    const mentionsBrand = haystack.includes(brand.name);
    const fromBrand = brand.domains.some((d) => senderDomain.includes(d));
    if (mentionsBrand && !fromBrand) {
      flags.push({
        type: "sender_mismatch",
        message: `Email references "${brand.name}" but sender domain is "${senderDomain}"`,
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
  return keywordFlags(
    bodyText,
    ATTACHMENT_PHRASES,
    "attachment_bait",
    "medium",
    (k) => `Potential attachment/document bait: "${k}"`,
  ).slice(0, 1);
}

/**
 * Combine signals with a noisy-OR over *distinct signal types*:
 * score = 1 - Π(1 - wₜ). Grouping by type first is what makes the score
 * measure "how many independent red flags" rather than "how many keywords
 * matched", so repeated phrases of one kind can't dominate. Each type lowers
 * the "clean" probability once (plus a small, capped bonus for repeat hits),
 * keeping the result a granular value in [0, 100].
 */
function computeScore(flags: AnalysisFlag[]): number {
  const hitsByType = new Map<string, number>();
  const severityByType = new Map<string, RiskLevel>();
  for (const flag of flags) {
    hitsByType.set(flag.type, (hitsByType.get(flag.type) ?? 0) + 1);
    if (!severityByType.has(flag.type)) {
      severityByType.set(flag.type, flag.severity);
    }
  }

  let cleanProbability = 1;
  for (const [type, count] of hitsByType) {
    const base =
      SIGNAL_WEIGHTS[type] ??
      SEVERITY_WEIGHTS[severityByType.get(type) ?? "low"] ??
      0.1;
    const repeatBonus = Math.min(
      (count - 1) * REPEAT_BONUS_PER_HIT,
      REPEAT_BONUS_CAP,
    );
    const weight = Math.min(Math.max(base * (1 + repeatBonus), 0), 0.95);
    cleanProbability *= 1 - weight;
  }

  return Math.round((1 - cleanProbability) * 100);
}

function getUniqueUrls(email: EmailData): string[] {
  const allUrls = [
    ...extractUrls(email.bodyText),
    ...email.links.map((l) => l.href),
  ];
  return [...new Set(allUrls)];
}

/** Run every offline (network-free) heuristic and return the raw flags. */
function collectOfflineFlags(email: EmailData): AnalysisFlag[] {
  const uniqueUrls = getUniqueUrls(email);

  // Subject lines carry many phishing cues, so text checks scan both.
  const scanText = `${email.subject}\n${email.bodyText}`;

  return [
    ...checkLinkMismatch(email.links),
    ...checkSuspiciousTLDs(uniqueUrls),
    ...checkIPUrls(uniqueUrls),
    ...checkHomoglyphs(uniqueUrls),
    ...checkPunycode(uniqueUrls),
    ...checkLookalikeDomains(uniqueUrls),
    ...checkShortenedUrls(uniqueUrls),
    ...checkUrgencyKeywords(scanText),
    ...checkCredentialRequests(scanText),
    ...checkFinancialLures(scanText),
    ...checkGenericGreeting(email.bodyText),
    ...checkGrammarFlags(email.bodyText),
    ...checkSenderMismatch(email),
    ...checkMissingSender(email),
    ...checkAttachmentBait(email.bodyText),
  ];
}

function finalize(flags: AnalysisFlag[]): BasicAnalysisResult {
  const score = computeScore(flags);
  const riskLevel =
    score <= RISK_THRESHOLDS.LOW_MAX
      ? "low"
      : score <= RISK_THRESHOLDS.MEDIUM_MAX
        ? "medium"
        : "high";

  return { score, riskLevel, flags };
}

/** Synchronous, fully-offline analysis. */
export function runBasicAnalysis(email: EmailData): BasicAnalysisResult {
  return finalize(collectOfflineFlags(email));
}

/** Hostnames worth a registration-age lookup: the sender plus any linked sites. */
function domainsToAge(email: EmailData): string[] {
  const hosts: string[] = [];

  const senderDomain = email.senderEmail.split("@")[1];
  if (senderDomain) hosts.push(senderDomain);

  for (const url of getUniqueUrls(email)) {
    try {
      hosts.push(new URL(url).hostname);
    } catch {
      // Skip unparseable URLs.
    }
  }

  return hosts;
}

/**
 * Full analysis including network-backed heuristics (domain age). Falls back to
 * the offline result if the lookups fail, so a flaky network never blocks or
 * skews a scan.
 */
export async function runBasicAnalysisWithNetwork(
  email: EmailData,
): Promise<BasicAnalysisResult> {
  const flags = collectOfflineFlags(email);
  try {
    flags.push(...(await checkDomainAge(domainsToAge(email))));
  } catch {
    // Domain-age lookups are best-effort; ignore failures entirely.
  }
  return finalize(flags);
}
