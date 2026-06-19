import type { AnalysisFlag } from "@shared/types";

/**
 * Domain-age heuristic.
 *
 * Freshly-registered domains are one of the strongest phishing signals: a
 * legitimate brand's domain is years old, while phishing payload sites are
 * often days or weeks old. Age can't be computed offline, so we look up the
 * registration date over RDAP (the modern, key-free successor to WHOIS) and
 * cache results so repeat scans stay cheap.
 *
 * The lookup always fails open: timeouts, network errors, unsupported TLDs, or
 * missing data yield *no* flag rather than a penalty, so the score never
 * depends on whether the network happened to answer.
 */

const RDAP_ENDPOINT = "https://rdap.org/domain/";
const LOOKUP_TIMEOUT_MS = 5000;
const MAX_LOOKUPS_PER_SCAN = 5;

// Age thresholds (days) and the flags they raise.
const NEW_DOMAIN_DAYS = 30;
const YOUNG_DOMAIN_DAYS = 90;

// Cache TTLs: a real registration date is effectively immutable, so cache it
// for a long time; cache "unknown" briefly so a transient failure retries soon.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NEGATIVE_CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const CACHE_PREFIX = "domain_age_";

const DAY_MS = 24 * 60 * 60 * 1000;

// Multi-level public suffixes we strip to find the registrable domain. Not the
// full Public Suffix List — just the common ones email/links actually use.
const MULTI_LEVEL_SUFFIXES = new Set([
  "co.uk",
  "org.uk",
  "gov.uk",
  "ac.uk",
  "co.jp",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "com.br",
  "co.in",
  "com.mx",
  "co.za",
]);

type CacheEntry = { createdMs: number | null; fetchedMs: number };

/** Reduce a hostname to its registrable domain (eTLD+1), best-effort. */
export function registrableDomain(host: string): string | null {
  const clean = host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const labels = clean.split(".");
  if (labels.length < 2) return null;

  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

async function readCache(domain: string): Promise<CacheEntry | null> {
  try {
    const key = CACHE_PREFIX + domain;
    const stored = await chrome.storage.local.get(key);
    const entry = stored[key] as CacheEntry | undefined;
    if (!entry) return null;

    const ttl = entry.createdMs === null ? NEGATIVE_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - entry.fetchedMs > ttl) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(domain: string, createdMs: number | null): Promise<void> {
  try {
    await chrome.storage.local.set({
      [CACHE_PREFIX + domain]: { createdMs, fetchedMs: Date.now() } as CacheEntry,
    });
  } catch {
    // Storage failures are non-fatal — we just lose the cache benefit.
  }
}

/** Pull the registration timestamp (ms) from an RDAP response, or null. */
function parseRegistrationDate(data: unknown): number | null {
  const events = (data as { events?: { eventAction?: string; eventDate?: string }[] })
    ?.events;
  if (!Array.isArray(events)) return null;

  const registration = events.find(
    (e) => e.eventAction === "registration" && e.eventDate,
  );
  if (!registration?.eventDate) return null;

  const ms = Date.parse(registration.eventDate);
  return Number.isNaN(ms) ? null : ms;
}

/** Look up a domain's registration date (ms since epoch), cached. */
async function lookupRegistrationMs(domain: string): Promise<number | null> {
  const cached = await readCache(domain);
  if (cached) return cached.createdMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(RDAP_ENDPOINT + encodeURIComponent(domain), {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    });
    if (!res.ok) {
      await writeCache(domain, null);
      return null;
    }
    const createdMs = parseRegistrationDate(await res.json());
    await writeCache(domain, createdMs);
    return createdMs;
  } catch {
    // Timeout / network / parse error — cache the miss briefly and move on.
    await writeCache(domain, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function ageFlag(domain: string, createdMs: number): AnalysisFlag | null {
  const ageDays = Math.floor((Date.now() - createdMs) / DAY_MS);
  if (ageDays < 0) return null;

  if (ageDays <= NEW_DOMAIN_DAYS) {
    return {
      type: "new_domain",
      message: `Domain "${domain}" was registered ${ageDays} day${ageDays === 1 ? "" : "s"} ago (newly created)`,
      severity: "high",
    };
  }
  if (ageDays <= YOUNG_DOMAIN_DAYS) {
    return {
      type: "young_domain",
      message: `Domain "${domain}" is only ${ageDays} days old`,
      severity: "medium",
    };
  }
  return null;
}

/**
 * Look up the age of each given domain and return flags for any that are
 * suspiciously young. Domains are reduced to their registrable form, deduped,
 * and capped to bound network usage. Always resolves (never rejects).
 */
export async function checkDomainAge(hosts: string[]): Promise<AnalysisFlag[]> {
  const domains = [...new Set(hosts.map(registrableDomain).filter(Boolean))] as string[];
  const targets = domains.slice(0, MAX_LOOKUPS_PER_SCAN);

  const results = await Promise.all(
    targets.map(async (domain) => {
      const createdMs = await lookupRegistrationMs(domain);
      return createdMs === null ? null : ageFlag(domain, createdMs);
    }),
  );

  return results.filter((flag): flag is AnalysisFlag => flag !== null);
}
