export function cleanDisplayText(text: string): string {
  return text
    .replace(/\uFFFD/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSenderLabel(name: string, email: string): string {
  const cleanName = cleanDisplayText(name);
  const cleanEmail = email.trim();
  if (cleanName && cleanEmail) return `${cleanName} <${cleanEmail}>`;
  if (cleanEmail) return cleanEmail;
  if (cleanName) return cleanName;
  return "Unknown sender";
}
