/** Phone / email normalization helpers for CRM channels. */

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) {
    // DE national → E.164 heuristic
    return `+49${digits.slice(1)}`;
  }
  return digits;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function displayNameFromParts(input: {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  kind?: "person" | "company";
  fallback?: string;
}): string {
  if (input.kind === "company" && input.company_name?.trim()) {
    return input.company_name.trim();
  }
  const name = [input.first_name, input.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  if (name) return name;
  if (input.company_name?.trim()) return input.company_name.trim();
  return input.fallback?.trim() || "Unbekannt";
}
