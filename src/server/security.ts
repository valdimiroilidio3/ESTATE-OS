/**
 * Security primitives shared by the API layer.
 *
 * Everything here is deliberately small and dependency-free so it can be unit
 * tested without a database: log redaction, SQL identifier validation, storage
 * key validation, upload signature sniffing, password strength and the escaping
 * used when server data is embedded in a `<script>` tag.
 */
import crypto from "node:crypto";

/** sha256 in hex. Session and invitation tokens are stored hashed, never raw. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex strings of the same length. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Signs the anonymous visitor identifier used by the public assistant.
 *
 * The cookie is the visitor's only handle on their conversation; without a
 * signature anyone could paste another value and append messages to somebody
 * else's transcript. The key never leaves the server.
 */
function visitorSecret(): string {
  return process.env.APP_SECRET || process.env.VISITOR_SECRET || "estate-os-development-visitor-key";
}

export function signVisitorKey(id: string): string {
  const mac = crypto.createHmac("sha256", visitorSecret()).update(id).digest("base64url").slice(0, 32);
  return `${id}.${mac}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns the visitor id when the signature is valid, otherwise null. */
export function verifyVisitorKey(value: string | undefined | null): string | null {
  if (!value) return null;
  const [id, mac] = value.split(".");
  if (!id || !mac || !UUID.test(id)) return null;
  const expected = signVisitorKey(id).split(".")[1];
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) return null;
  return crypto.timingSafeEqual(left, right) ? id : null;
}

const SENSITIVE_KEY =
  /(pass(word|wd)?|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|password_hash|credential|signature)/i;

const MAX_LOG_STRING = 300;

/**
 * Deep-copies a value for logging, replacing anything that looks like a
 * credential. Error messages routinely carry connection strings and query
 * parameters, so this runs on every audit record and every server log.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[profundo]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_LOG_STRING ? `${value.slice(0, MAX_LOG_STRING)}…` : redactString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source).slice(0, 60)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[removido]" : redact(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Removes credentials embedded in URLs and connection strings. */
function redactString(value: string): string {
  if (/(postgres(ql)?|redis|mysql):\/\//i.test(value)) {
    return value.replace(/(\w+:\/\/)([^@\s]+)@/gi, "$1[credenciais]@");
  }
  if (/^(bearer|basic)\s+/i.test(value)) return "[credenciais]";
  if (/^ey[A-Za-z0-9_-]{10,}\./.test(value)) return "[token]";
  return value;
}

/**
 * Serialises data for an inline `<script type="application/ld+json">` block.
 * `JSON.stringify` alone is not safe there: a property title containing
 * `</script>` would close the tag and inject markup.
 */
export function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;

/**
 * Column names are interpolated into `UPDATE … SET` statements. Every current
 * caller builds them from a literal object, but validating keeps a future
 * refactor from turning a data-driven key into SQL injection.
 */
export function assertIdentifiers(keys: string[], context = "coluna"): void {
  for (const key of keys) {
    if (!IDENTIFIER.test(key)) {
      throw new Error(`Identificador de ${context} inválido: ${JSON.stringify(key).slice(0, 60)}`);
    }
  }
}

/**
 * Storage keys are generated internally (`media/<org>/<uuid>.ext`), but the fs
 * driver joins them onto a directory: a key containing `..` would escape it.
 */
export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > 300) return false;
  if (key.startsWith("/") || key.includes("\\") || key.includes("\0")) return false;
  if (key.split("/").some((part) => part === ".." || part === "." || part === "")) return false;
  return /^[A-Za-z0-9._/-]+$/.test(key);
}

export type SniffResult = "image" | "pdf" | "video" | "unknown";

/**
 * Reads the magic bytes of an upload. The browser-supplied MIME type is only a
 * claim; a file that is served back later must be recognisable for what it is.
 */
export function sniffUpload(buffer: Buffer): SniffResult {
  const b = buffer;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image"; // JPEG
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image"; // PNG
  }
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image"; // WEBP
  }
  if (b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = b.subarray(8, 12).toString("ascii");
    if (brand.startsWith("avi")) return "image"; // AVIF
    if (brand.startsWith("qt") || brand.startsWith("mp4") || brand.startsWith("isom")) return "video";
  }
  if (b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video"; // WebM/MKV
  if (b.length >= 5 && b.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return "unknown";
}

/** Maps a declared MIME type to the signature family we expect to find. */
export function expectedFamily(mimeType: string): SniffResult {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown";
}

/**
 * Escapes one CSV cell.
 *
 * Spreadsheet software evaluates a cell that starts with `=`, `@`, tab or CR as
 * a formula; a lead called `=HYPERLINK("http://…")` would become a live link in
 * the exported file. Such values get a leading apostrophe. Phone numbers like
 * `+351…` are left readable because `+` followed by a digit is not a formula.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const risky = /^[=@\t\r]/.test(text) || /^[+-]\s*[^\d\s]/.test(text);
  const safe = risky ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

const COMMON_PASSWORDS = new Set([
  "1234567890",
  "12345678910",
  "password123",
  "password1234",
  "qwertyuiop",
  "qwerty12345",
  "palavrapasse",
  "palavrapasse1",
  "estateos2026",
  "administrador",
  "admin12345",
  "letmein123",
  "iloveyou123",
  "bemvindo123",
  "benfica123",
  "sporting123",
  "porto12345",
  "mudardepressa",
  "0000000000",
  "aaaaaaaaaa",
  "1111111111",
]);

/**
 * Password policy. Length beats character classes (NIST SP 800-63B), so the
 * only hard rules are length, a small blocklist of obvious choices and the
 * absence of the account's own e-mail.
 */
export function passwordProblem(password: string, email?: string): string | null {
  const value = password.normalize("NFKC");
  if (value.length < 10) return "A palavra-passe deve ter pelo menos 10 caracteres.";
  if (value.length > 200) return "A palavra-passe é demasiado longa.";
  const lowered = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lowered)) return "Escolha uma palavra-passe menos previsível.";
  if (/^(.)\1+$/.test(lowered)) return "Escolha uma palavra-passe com mais variedade.";
  if (email) {
    const local = email.split("@")[0]?.toLowerCase() ?? "";
    if (local.length >= 4 && lowered.includes(local)) return "A palavra-passe não deve conter o seu email.";
  }
  if (/^(1234|abcd|qwer|asdf|zxcv)/.test(lowered)) return "Escolha uma palavra-passe menos previsível.";
  return null;
}
