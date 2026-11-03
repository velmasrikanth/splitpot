import { createHmac, timingSafeEqual } from "node:crypto";

type SessionClaims = {
  sub: string;
  exp: number;
};

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function signSession(userId: string, secret: string, ttlSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(JSON.stringify({ sub: userId, exp: nowSeconds + ttlSeconds }));
  const data = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

export function verifySession(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionClaims>;
    if (typeof claims.sub !== "string" || claims.sub.length === 0 || typeof claims.exp !== "number") {
      return null;
    }
    if (claims.exp <= nowSeconds) {
      return null;
    }
    return { sub: claims.sub, exp: claims.exp };
  } catch {
    return null;
  }
}
