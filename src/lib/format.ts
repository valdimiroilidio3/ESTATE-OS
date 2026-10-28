export function money(cents: number | null | undefined, currency = "EUR", locale = "pt-PT") {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function compactNumber(n: number) {
  return new Intl.NumberFormat("pt-PT", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function dateShort(value: string | null | undefined, locale = "pt-PT") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

export function dateTime(value: string | null | undefined, locale = "pt-PT") {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  if (abs < hour) return rtf.format(-Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(-Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(-Math.round(diff / day), "day");
  return dateShort(value);
}

export function areaLabel(value: number | null | undefined) {
  return value ? `${new Intl.NumberFormat("pt-PT").format(value)} m²` : null;
}

export function pluralize(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function pct(value: number | null) {
  if (value === null) return "Dados insuficientes";
  return `${value.toFixed(1)}%`;
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
