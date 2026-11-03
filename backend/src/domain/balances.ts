export type MemberBalance = {
  memberId: string;
  netMinor: number;
};

export type ExpenseLike = {
  amountMinor: number;
  paidByMemberId: string;
  splits: { memberId: string; shareMinor: number }[];
};

export type SettlementLike = {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
};

export function netBalances(
  memberIds: string[],
  expenses: ExpenseLike[],
  settlements: SettlementLike[],
): MemberBalance[] {
  const paid = new Map<string, number>(memberIds.map((memberId) => [memberId, 0]));
  const share = new Map<string, number>(memberIds.map((memberId) => [memberId, 0]));

  for (const expense of expenses) {
    paid.set(expense.paidByMemberId, (paid.get(expense.paidByMemberId) ?? 0) + expense.amountMinor);
    for (const split of expense.splits) {
      share.set(split.memberId, (share.get(split.memberId) ?? 0) + split.shareMinor);
    }
  }

  const balances: MemberBalance[] = memberIds.map((memberId) => ({
    memberId,
    netMinor: (paid.get(memberId) ?? 0) - (share.get(memberId) ?? 0),
  }));

  for (const settlement of settlements) {
    const from = balances.find((balance) => balance.memberId === settlement.fromMemberId);
    const to = balances.find((balance) => balance.memberId === settlement.toMemberId);
    if (!from || !to) {
      throw new Error("settlement member is missing");
    }
    from.netMinor += settlement.amountMinor;
    to.netMinor -= settlement.amountMinor;
  }

  return balances;
}

export function paidAndShare(
  memberIds: string[],
  expenses: ExpenseLike[],
): { memberId: string; paidMinor: number; shareMinor: number }[] {
  const paid = new Map<string, number>(memberIds.map((memberId) => [memberId, 0]));
  const share = new Map<string, number>(memberIds.map((memberId) => [memberId, 0]));
  for (const expense of expenses) {
    paid.set(expense.paidByMemberId, (paid.get(expense.paidByMemberId) ?? 0) + expense.amountMinor);
    for (const split of expense.splits) {
      share.set(split.memberId, (share.get(split.memberId) ?? 0) + split.shareMinor);
    }
  }
  return memberIds.map((memberId) => ({
    memberId,
    paidMinor: paid.get(memberId) ?? 0,
    shareMinor: share.get(memberId) ?? 0,
  }));
}
