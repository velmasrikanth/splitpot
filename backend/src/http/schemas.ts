import { z } from "zod";
import { isoDateSchema } from "./validation.js";

export const signupSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

const categorySchema = z.enum(["food", "stay", "transport", "drinks", "activities", "shopping", "other"]);
const currencySchema = z.enum(["INR", "USD", "EUR", "GBP"]);
const groupTypeSchema = z.enum(["party", "trip"]);

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: groupTypeSchema,
  currency: currencySchema.default("INR"),
  startDate: isoDateSchema.nullable().optional(),
  endDate: isoDateSchema.nullable().optional(),
});

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    type: groupTypeSchema.optional(),
    currency: currencySchema.optional(),
    status: z.enum(["open", "closed"]).optional(),
    startDate: isoDateSchema.nullable().optional(),
    endDate: isoDateSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Provide at least one field to update",
  });

export const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(4).max(64),
  claimMemberId: z.string().min(1).optional(),
});

export const guestMemberSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

const expenseFields = {
  description: z.string().trim().min(1).max(200),
  amountMinor: z.number().int().positive().max(1_000_000_000),
  date: isoDateSchema,
  category: categorySchema,
  paidByMemberId: z.string().min(1),
};

export const expenseSchema = z.discriminatedUnion("splitType", [
  z.object({
    ...expenseFields,
    splitType: z.literal("equal"),
    memberIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    ...expenseFields,
    splitType: z.literal("exact"),
    lines: z.array(z.object({ memberId: z.string().min(1), amountMinor: z.number().int().positive() })).min(1),
  }),
  z.object({
    ...expenseFields,
    splitType: z.literal("percentage"),
    lines: z
      .array(z.object({ memberId: z.string().min(1), basisPoints: z.number().int().positive().max(10_000) }))
      .min(1),
  }),
  z.object({
    ...expenseFields,
    splitType: z.literal("shares"),
    lines: z.array(z.object({ memberId: z.string().min(1), shares: z.number().int().positive().max(1_000_000) })).min(1),
  }),
]);

export const settlementSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amountMinor: z.number().int().positive().max(1_000_000_000),
  date: isoDateSchema,
});

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const memberParamsSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
});

export const expenseParamsSchema = z.object({
  id: z.string().min(1),
  expenseId: z.string().min(1),
});

export const settlementParamsSchema = z.object({
  id: z.string().min(1),
  settlementId: z.string().min(1),
});
