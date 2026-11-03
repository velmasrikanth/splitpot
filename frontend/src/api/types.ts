export type Currency = "INR" | "USD" | "EUR" | "GBP";
export type GroupType = "party" | "trip";
export type GroupStatus = "open" | "closed";
export type Category = "food" | "stay" | "transport" | "drinks" | "activities" | "shopping" | "other";
export type SplitType = "equal" | "exact" | "percentage" | "shares";

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type Member = {
  id: string;
  userId: string | null;
  displayName: string;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  currency: Currency;
  status: GroupStatus;
  inviteCode: string;
  startDate: string | null;
  endDate: string | null;
  createdById: string;
  createdAt: string;
  members: Member[];
};

export type ExpenseSplit = {
  memberId: string;
  shareMinor: number;
};

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amountMinor: number;
  category: Category;
  date: string;
  paidByMemberId: string;
  splitType: SplitType;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  splits: ExpenseSplit[];
};

export type SummaryMember = {
  memberId: string;
  displayName: string;
  paidMinor: number;
  shareMinor: number;
  netMinor: number;
};

export type Summary = {
  totalMinor: number;
  settled: boolean;
  members: SummaryMember[];
  categories: { category: Category; totalMinor: number }[];
  transfers: { fromMemberId: string; toMemberId: string; amountMinor: number }[];
};

export type Settlement = {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  date: string;
  createdAt: string;
};

export type ExpensePayload =
  | {
      description: string;
      amountMinor: number;
      date: string;
      category: Category;
      paidByMemberId: string;
      splitType: "equal";
      memberIds: string[];
    }
  | {
      description: string;
      amountMinor: number;
      date: string;
      category: Category;
      paidByMemberId: string;
      splitType: "exact";
      lines: { memberId: string; amountMinor: number }[];
    }
  | {
      description: string;
      amountMinor: number;
      date: string;
      category: Category;
      paidByMemberId: string;
      splitType: "percentage";
      lines: { memberId: string; basisPoints: number }[];
    }
  | {
      description: string;
      amountMinor: number;
      date: string;
      category: Category;
      paidByMemberId: string;
      splitType: "shares";
      lines: { memberId: string; shares: number }[];
    };
