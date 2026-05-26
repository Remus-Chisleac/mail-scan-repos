import type { EmailLink, AnalysisFlag } from "@shared/types";

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

const SUSPICIOUS_TLDS = new Set([
  ".xyz",
  ".top",
  ".buzz",
  ".tk",
  ".ml",
  ".ga",
  ".cf",
  ".gq",
  ".pw",
  ".cc",
  ".click",
  ".link",
  ".info",
  ".club",
  ".work",
  ".loan",
  ".win",
]);

const SHORTENER_DOMAINS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rb.gy",
  "cutt.ly",
  "shorturl.at",
]);

const HOMOGLYPH_MAP: Record<string, string> = {
  "0": "o",
  "1": "l",
  "!": "i",
  "@": "a",
  "3": "e",
  "5": "s",
  "\u0430": "a",
  "\u0435": "e",
  "\u043e": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
};

function getDomain(urlStr: string): string | null {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractUrls(body: string): string[] {
  return [...body.matchAll(URL_REGEX)].map((m) => m[0]);
}

export function checkLinkMismatch(links: EmailLink[]): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];

  for (const link of links) {
    const textLooksLikeUrl =
      /^https?:\/\//.test(link.text) || /^www\./.test(link.text);
    if (!textLooksLikeUrl) continue;

    const textDomain = getDomain(
      link.text.startsWith("http") ? link.text : `https://${link.text}`,
    );
    const hrefDomain = getDomain(link.href);

    if (textDomain && hrefDomain && textDomain !== hrefDomain) {
      flags.push({
        type: "link_mismatch",
        message: `Link text shows "${textDomain}" but actually goes to "${hrefDomain}"`,
        severity: "high",
      });
    }
  }

  return flags;
}

export function checkSuspiciousTLDs(urls: string[]): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const domain = getDomain(url);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);

    const tld = "." + domain.split(".").pop();
    if (SUSPICIOUS_TLDS.has(tld)) {
      flags.push({
        type: "suspicious_tld",
        message: `Suspicious domain: "${domain}" uses ${tld} TLD`,
        severity: "medium",
      });
    }
  }

  return flags;
}

export function checkIPUrls(urls: string[]): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

  for (const url of urls) {
    const domain = getDomain(url);
    if (domain && ipRegex.test(domain)) {
      flags.push({
        type: "ip_url",
        message: `URL uses raw IP address: ${domain}`,
        severity: "high",
      });
    }
  }

  return flags;
}

export function checkHomoglyphs(urls: string[]): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const domain = getDomain(url);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);

    let hasHomoglyph = false;
    for (const char of domain) {
      if (HOMOGLYPH_MAP[char] !== undefined) {
        hasHomoglyph = true;
        break;
      }
    }

    if (hasHomoglyph) {
      flags.push({
        type: "homoglyph",
        message: `Domain "${domain}" contains lookalike characters (possible spoofing)`,
        severity: "high",
      });
    }
  }

  return flags;
}

export function checkShortenedUrls(urls: string[]): AnalysisFlag[] {
  const flags: AnalysisFlag[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const domain = getDomain(url);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);

    if (SHORTENER_DOMAINS.has(domain) || domain.endsWith(".ly")) {
      flags.push({
        type: "shortened_url",
        message: `Shortened URL detected: ${domain}`,
        severity: "medium",
      });
    }
  }

  return flags;
}
