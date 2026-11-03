const COOKIE_NAME = "token";

export function readCookie(header: string | undefined, name = COOKIE_NAME): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean, maxAgeSeconds: number): string {
  const parts = [`${COOKIE_NAME}=${token}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAgeSeconds}`];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [`${COOKIE_NAME}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
