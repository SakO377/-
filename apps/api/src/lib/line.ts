export type LineMessage = { type: "text"; text: string };

export async function verifyLineSignature(
  body: string,
  signature: string | null,
  channelSecret: string
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}

export interface VerifiedLineUser {
  sub: string;
  name?: string;
}

export async function verifyLineIdToken(
  idToken: string,
  channelId: string
): Promise<VerifiedLineUser | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) return null;
  const data = await res.json<{ sub: string; name?: string; aud: string }>();
  if (data.aud !== channelId) return null;
  return { sub: data.sub, name: data.name };
}

export async function replyMessage(
  accessToken: string,
  replyToken: string,
  messages: LineMessage[]
): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function pushMessage(
  accessToken: string,
  to: string,
  messages: LineMessage[]
): Promise<Response> {
  return fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}

export async function multicastMessage(
  accessToken: string,
  to: string[],
  messages: LineMessage[]
): Promise<Response> {
  return fetch("https://api.line.me/v2/bot/message/multicast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}
