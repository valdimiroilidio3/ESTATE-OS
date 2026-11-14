import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIdentifiers,
  csvCell,
  escapeInlineJson,
  expectedFamily,
  hashToken,
  isSafeStorageKey,
  passwordProblem,
  redact,
  safeEqualHex,
  signVisitorKey,
  sniffUpload,
  verifyVisitorKey,
} from "../src/server/security";

/* ─────────────── injection and output escaping ─────────────── */

test("inline JSON cannot close the script tag", () => {
  const payload = { name: 'Villa </script><img src=x onerror="alert(1)">' };
  const encoded = escapeInlineJson(payload);
  assert.ok(!encoded.includes("</script>"));
  assert.ok(!encoded.includes("<"));
  // Still valid JSON that round-trips to the original value.
  assert.deepEqual(JSON.parse(encoded), payload);
});

test("inline JSON escapes line separators and ampersands", () => {
  const encoded = escapeInlineJson({ a: "x\u2028y\u2029z&w" });
  assert.ok(!encoded.includes("\u2028"));
  assert.ok(!encoded.includes("\u2029"));
  assert.ok(!encoded.includes("&"));
});

test("column identifiers reject anything that is not a plain name", () => {
  assert.doesNotThrow(() => assertIdentifiers(["title", "price_cents", "updated_at"]));
  for (const bad of ["title = 'x'", 'a"b', "a; DROP TABLE leads", "1abc", "", "a-b", "a b"]) {
    assert.throws(() => assertIdentifiers([bad]), /inválido/, `deveria rejeitar ${JSON.stringify(bad)}`);
  }
});

test("CSV cells neutralise spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), '"\'=HYPERLINK(""http://evil"",""x"")"');
  assert.equal(csvCell("@SUM(1)"), '"\'@SUM(1)"');
  // A negative number is not a formula.
  assert.equal(csvCell("-2+3"), '"-2+3"');
  assert.equal(csvCell("-cmd|' /C calc'!A0"), '"\'-cmd|\' /C calc\'!A0"');
  // A phone number stays readable.
  assert.equal(csvCell("+351 912 345 678"), '"+351 912 345 678"');
  assert.equal(csvCell('Ana "A" Silva'), '"Ana ""A"" Silva"');
  assert.equal(csvCell(null), '""');
});

/* ─────────────── storage ─────────────── */

test("storage keys cannot escape the uploads directory", () => {
  assert.ok(isSafeStorageKey("media/3f1c/uuid.jpg"));
  assert.ok(isSafeStorageKey("documents/org/uuid.pdf"));
  for (const bad of ["../etc/passwd", "media/../../secret.jpg", "/etc/passwd", "media//x.jpg", "a\\b.jpg", "", "x\0y"]) {
    assert.equal(isSafeStorageKey(bad), false, `deveria rejeitar ${JSON.stringify(bad)}`);
  }
});

/* ─────────────── uploads ─────────────── */

test("upload signatures are read from magic bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdf = Buffer.from("%PDF-1.7 rest", "ascii");
  const html = Buffer.from("<html><script>alert(1)</script>", "ascii");
  assert.equal(sniffUpload(jpeg), "image");
  assert.equal(sniffUpload(png), "image");
  assert.equal(sniffUpload(pdf), "pdf");
  assert.equal(sniffUpload(html), "unknown");
  assert.equal(expectedFamily("image/jpeg"), "image");
  assert.equal(expectedFamily("application/pdf"), "pdf");
  assert.equal(expectedFamily("application/msword"), "unknown");
  // An HTML file uploaded as a JPEG is not accepted as an image.
  assert.notEqual(sniffUpload(html), expectedFamily("image/jpeg"));
});

/* ─────────────── credentials ─────────────── */

test("tokens are hashed, never stored raw", () => {
  const token = "9f2c8f0a-raw-invitation-token";
  const hashed = hashToken(token);
  assert.notEqual(hashed, token);
  assert.equal(hashed.length, 64);
  assert.equal(hashed, hashToken(token));
  assert.notEqual(hashed, hashToken(`${token}x`));
});

test("token comparison is length-safe", () => {
  assert.equal(safeEqualHex(hashToken("a"), hashToken("a")), true);
  assert.equal(safeEqualHex(hashToken("a"), hashToken("b")), false);
  assert.equal(safeEqualHex("", ""), false);
  assert.equal(safeEqualHex("abcd", "abcdef"), false);
});

test("weak passwords are rejected with an explanation", () => {
  assert.match(passwordProblem("curta") ?? "", /10 caracteres/);
  assert.match(passwordProblem("password123") ?? "", /previsível/);
  assert.match(passwordProblem("aaaaaaaaaaaa") ?? "", /variedade/);
  assert.match(passwordProblem("ana.ferreira2026", "ana.ferreira@example.com") ?? "", /email/);
  assert.equal(passwordProblem("Serra-Da-Estrela-2026", "ana@example.com"), null);
});

test("visitor identifiers are signed and cannot be forged", () => {
  const id = "6f1d9f26-31a1-4c8e-9b6f-2a4fd1c9e123";
  const signed = signVisitorKey(id);
  assert.equal(verifyVisitorKey(signed), id);
  // Tampering with the identifier or the signature invalidates the cookie.
  assert.equal(verifyVisitorKey(id), null);
  assert.equal(verifyVisitorKey(`${id}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`), null);
  assert.equal(verifyVisitorKey("not-a-uuid.signature"), null);
  assert.equal(verifyVisitorKey(undefined), null);
  assert.equal(verifyVisitorKey(""), null);
});

/* ─────────────── logging ─────────────── */

test("log redaction removes credentials and connection strings", () => {
  const cleaned = redact({
    email: "ana@example.com",
    password: "Segredo123!",
    nested: { Authorization: "Bearer abc.def", password_hash: "scrypt$1$2$3" },
    url: "postgresql://user:s3cret@db.host/estate",
    token: "abc",
  }) as Record<string, any>;
  assert.equal(cleaned.email, "ana@example.com");
  assert.equal(cleaned.password, "[removido]");
  assert.equal(cleaned.nested.Authorization, "[removido]");
  assert.equal(cleaned.nested.password_hash, "[removido]");
  assert.equal(cleaned.url, "postgresql://[credenciais]@db.host/estate");
  assert.equal(cleaned.token, "[removido]");
});

test("log redaction truncates long strings and handles cycles of depth", () => {
  const long = "x".repeat(500);
  assert.equal((redact({ note: long }) as Record<string, string>).note.length <= 301, true);
  const deep: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = deep;
  for (let i = 0; i < 12; i += 1) {
    cursor.next = {};
    cursor = cursor.next as Record<string, unknown>;
  }
  assert.doesNotThrow(() => JSON.stringify(redact(deep)));
});
