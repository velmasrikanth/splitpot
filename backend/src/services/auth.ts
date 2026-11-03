import argon2 from "argon2";
import { AppError } from "../http/errors.js";
import type { UserRepository } from "../repositories/users.js";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

function presentUser(user: { id: string; email: string; name: string; createdAt: Date }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService(users: UserRepository) {
  let dummyHash: Promise<string> | undefined;
  const paddingHash = () => {
    dummyHash ??= argon2.hash("splitpot-timing-pad");
    return dummyHash;
  };

  return {
    async signup(input: { email: string; password: string; name: string }) {
      const email = input.email.toLowerCase();
      const existing = await users.findByEmail(email);
      if (existing) {
        throw new AppError(409, "EMAIL_TAKEN", "An account with that email already exists");
      }
      const passwordHash = await argon2.hash(input.password);
      const user = await users.create({ email, passwordHash, name: input.name });
      return presentUser(user);
    },

    async login(input: { email: string; password: string }) {
      const user = await users.findByEmail(input.email.toLowerCase());
      if (!user) {
        await argon2.verify(await paddingHash(), input.password);
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
      }
      const matches = await argon2.verify(user.passwordHash, input.password);
      if (!matches) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
      }
      return presentUser(user);
    },

    async me(userId: string) {
      const user = await users.findPublicById(userId);
      if (!user) {
        throw new AppError(401, "UNAUTHENTICATED", "Sign in required");
      }
      return presentUser(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
