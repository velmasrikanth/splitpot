import type { MemberBalance } from "./balances.js";

export type Transfer = {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
};

type Side = {
  memberId: string;
  left: number;
};

function byLargestThenId(left: Side, right: Side): number {
  if (right.left !== left.left) {
    return right.left - left.left;
  }
  if (left.memberId < right.memberId) {
    return -1;
  }
  if (left.memberId > right.memberId) {
    return 1;
  }
  return 0;
}

export function suggestTransfers(balances: MemberBalance[]): Transfer[] {
  const sum = balances.reduce((total, balance) => total + balance.netMinor, 0);
  if (sum !== 0) {
    throw new Error("balances do not sum to zero");
  }

  const creditors: Side[] = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({ memberId: balance.memberId, left: balance.netMinor }));
  const debtors: Side[] = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({ memberId: balance.memberId, left: -balance.netMinor }));
  const transfers: Transfer[] = [];

  while (creditors.some((side) => side.left > 0) && debtors.some((side) => side.left > 0)) {
    creditors.sort(byLargestThenId);
    debtors.sort(byLargestThenId);
    const creditor = creditors.find((side) => side.left > 0);
    const debtor = debtors.find((side) => side.left > 0);
    if (!creditor || !debtor) {
      break;
    }
    const amountMinor = Math.min(creditor.left, debtor.left);
    if (amountMinor <= 0) {
      break;
    }
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountMinor,
    });
    creditor.left -= amountMinor;
    debtor.left -= amountMinor;
  }

  return transfers;
}

export function applyTransfers(balances: MemberBalance[], transfers: Transfer[]): MemberBalance[] {
  const nets = new Map(balances.map((balance) => [balance.memberId, balance.netMinor]));
  for (const transfer of transfers) {
    nets.set(transfer.fromMemberId, (nets.get(transfer.fromMemberId) ?? 0) + transfer.amountMinor);
    nets.set(transfer.toMemberId, (nets.get(transfer.toMemberId) ?? 0) - transfer.amountMinor);
  }
  return [...nets.entries()].map(([memberId, netMinor]) => ({ memberId, netMinor }));
}
