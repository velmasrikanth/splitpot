export class SplitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitError";
  }
}

export type ShareLine = { memberId: string; shareMinor: number };

export type SplitRequest =
  | { type: "equal"; memberIds: string[] }
  | { type: "exact"; lines: { memberId: string; amountMinor: number }[] }
  | { type: "percentage"; lines: { memberId: string; basisPoints: number }[] }
  | { type: "shares"; lines: { memberId: string; shares: number }[] };

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SplitError(`${label} must be a positive integer`);
  }
}

function assertUnique(memberIds: string[]): void {
  if (memberIds.length === 0) {
    throw new SplitError("Choose at least one member");
  }
  const seen = new Set<string>();
  for (const memberId of memberIds) {
    if (seen.has(memberId)) {
      throw new SplitError("A member can only appear once in a split");
    }
    seen.add(memberId);
  }
}

function allocate(amountMinor: number, parts: { memberId: string; weight: number }[]): ShareLine[] {
  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const sorted = [...parts].sort((left, right) => (left.memberId < right.memberId ? -1 : left.memberId > right.memberId ? 1 : 0));
  const lines = sorted.map((part) => ({
    memberId: part.memberId,
    shareMinor: Math.floor((amountMinor * part.weight) / totalWeight),
  }));
  let remainder = amountMinor - lines.reduce((sum, line) => sum + line.shareMinor, 0);
  let index = 0;
  while (remainder > 0) {
    const line = lines[index % lines.length];
    if (!line) {
      break;
    }
    line.shareMinor += 1;
    remainder -= 1;
    index += 1;
  }
  return lines;
}

export function calculateSplits(amountMinor: number, request: SplitRequest): ShareLine[] {
  assertPositiveInteger(amountMinor, "Amount");
  if (request.type === "equal") {
    assertUnique(request.memberIds);
    return allocate(amountMinor, request.memberIds.map((memberId) => ({ memberId, weight: 1 })));
  }
  if (request.type === "exact") {
    assertUnique(request.lines.map((line) => line.memberId));
    const sum = request.lines.reduce((total, line) => {
      assertPositiveInteger(line.amountMinor, "Exact amount");
      return total + line.amountMinor;
    }, 0);
    if (sum !== amountMinor) {
      throw new SplitError(`Exact amounts must add up to ${amountMinor}`);
    }
    return request.lines.map((line) => ({ memberId: line.memberId, shareMinor: line.amountMinor }));
  }
  if (request.type === "percentage") {
    assertUnique(request.lines.map((line) => line.memberId));
    const sum = request.lines.reduce((total, line) => {
      assertPositiveInteger(line.basisPoints, "Percentage");
      return total + line.basisPoints;
    }, 0);
    if (sum !== 10_000) {
      throw new SplitError("Percentages must add up to 100%");
    }
    return allocate(amountMinor, request.lines.map((line) => ({ memberId: line.memberId, weight: line.basisPoints })));
  }
  assertUnique(request.lines.map((line) => line.memberId));
  for (const line of request.lines) {
    assertPositiveInteger(line.shares, "Shares");
  }
  return allocate(amountMinor, request.lines.map((line) => ({ memberId: line.memberId, weight: line.shares })));
}

export function equalBasisPoints(memberIds: string[]): Record<string, number> {
  const lines = calculateSplits(10_000, { type: "equal", memberIds });
  return Object.fromEntries(lines.map((line) => [line.memberId, line.shareMinor]));
}
