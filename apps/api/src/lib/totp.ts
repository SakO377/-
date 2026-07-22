// 2段階認証(TOTP, RFC 6238)。Cloudflare Workers の Web Crypto(HMAC-SHA1)で実装する。
// 30秒ステップ・6桁・SHA-1(認証アプリの標準)。

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateBase32Secret(bytes = 20): string {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  let bits = "";
  for (const b of random) bits += b.toString(2).padStart(8, "0");
  let secret = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Uint8Array {
  const clean = secret.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = "";
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message);
  return new Uint8Array(sig);
}

async function generateCode(secret: string, counter: number): Promise<string> {
  const key = base32Decode(secret);
  const msg = new Uint8Array(8);
  // 64bit big-endian のカウンター(下位32bitで十分な範囲)
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hash = await hmacSha1(key, msg);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, "0");
}

/** 現在時刻±windowステップの範囲でコードを検証する(時計ずれ対策)。 */
export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
  const cleaned = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if ((await generateCode(secret, counter + w)) === cleaned) return true;
  }
  return false;
}

/** リカバリーコード(表示用)を生成する。例: "A3F9-K2M7"。 */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  let s = "";
  for (const b of bytes) s += BASE32_ALPHABET[b % 32];
  return `${s.slice(0, 4)}-${s.slice(4)}${BASE32_ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % 32]}`;
}

/** リカバリーコードはSHA-256でハッシュ化して保存する(入力が高エントロピーなため十分)。 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim().toUpperCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 認証アプリ登録用の otpauth URI を組み立てる。 */
export function buildOtpAuthUri(secret: string, accountName: string, issuer = "School Harness"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
