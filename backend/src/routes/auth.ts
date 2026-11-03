import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { clearSessionCookie, readCookie, sessionCookie } from "../http/cookies.js";
import { AppError } from "../http/errors.js";
import { verifySession, signSession } from "../http/jwt.js";
import type { AuthService } from "../services/auth.js";
import type { PublicUser } from "../services/auth.js";
import { loginSchema, signupSchema } from "../http/schemas.js";
import { parseInput } from "../http/validation.js";

export async function requireUser(config: AppConfig, auth: AuthService, cookieHeader: string | undefined): Promise<PublicUser> {
  const token = readCookie(cookieHeader);
  if (!token) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in required");
  }
  const claims = verifySession(token, config.JWT_SECRET);
  if (!claims) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in required");
  }
  return auth.me(claims.sub);
}

export function registerAuthRoutes(
  app: FastifyInstance,
  config: AppConfig,
  auth: AuthService,
  allow: (key: string) => boolean,
): void {
  const secure = config.NODE_ENV === "prod";

  app.post("/api/auth/signup", async (request, reply) => {
    if (!allow(request.ip || "local")) {
      throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again shortly");
    }
    const body = parseInput(signupSchema, request.body);
    const user = await auth.signup(body);
    const token = signSession(user.id, config.JWT_SECRET, config.SESSION_TTL_SECONDS);
    reply.header("set-cookie", sessionCookie(token, secure, config.SESSION_TTL_SECONDS));
    return reply.code(201).send(user);
  });

  app.post("/api/auth/login", async (request, reply) => {
    if (!allow(request.ip || "local")) {
      throw new AppError(429, "RATE_LIMITED", "Too many attempts. Try again shortly");
    }
    const body = parseInput(loginSchema, request.body);
    const user = await auth.login(body);
    const token = signSession(user.id, config.JWT_SECRET, config.SESSION_TTL_SECONDS);
    reply.header("set-cookie", sessionCookie(token, secure, config.SESSION_TTL_SECONDS));
    return reply.send(user);
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await requireUser(config, auth, request.headers.cookie);
    reply.header("set-cookie", clearSessionCookie(secure));
    return reply.code(204).send();
  });

  app.get("/api/auth/me", async (request) => {
    return requireUser(config, auth, request.headers.cookie);
  });
}
