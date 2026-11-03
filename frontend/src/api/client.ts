import type { Expense, ExpensePayload, Group, Settlement, Summary, User } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as { error?: { code?: string; message?: string } }) : null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code ?? "REQUEST_FAILED", data?.error?.message ?? "Something went wrong");
  }
  return data as T;
}

export const api = {
  signup(body: { email: string; password: string; name: string }) {
    return request<User>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) });
  },
  login(body: { email: string; password: string }) {
    return request<User>("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
  },
  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<User>("/api/auth/me");
  },
  listGroups() {
    return request<Group[]>("/api/groups");
  },
  createGroup(body: { name: string; type: Group["type"]; currency: Group["currency"]; startDate: string | null; endDate: string | null }) {
    return request<Group>("/api/groups", { method: "POST", body: JSON.stringify(body) });
  },
  getGroup(id: string) {
    return request<Group>(`/api/groups/${id}`);
  },
  updateGroup(id: string, body: { status?: Group["status"]; name?: string }) {
    return request<Group>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  joinGroup(inviteCode: string) {
    return request<Group>("/api/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) });
  },
  addGuest(groupId: string, displayName: string) {
    return request<Group>(`/api/groups/${groupId}/members`, { method: "POST", body: JSON.stringify({ displayName }) });
  },
  removeMember(groupId: string, memberId: string) {
    return request<void>(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
  },
  listExpenses(groupId: string) {
    return request<Expense[]>(`/api/groups/${groupId}/expenses`);
  },
  createExpense(groupId: string, body: ExpensePayload) {
    return request<Expense>(`/api/groups/${groupId}/expenses`, { method: "POST", body: JSON.stringify(body) });
  },
  updateExpense(groupId: string, expenseId: string, body: ExpensePayload) {
    return request<Expense>(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "PATCH", body: JSON.stringify(body) });
  },
  deleteExpense(groupId: string, expenseId: string) {
    return request<void>(`/api/groups/${groupId}/expenses/${expenseId}`, { method: "DELETE" });
  },
  summary(groupId: string) {
    return request<Summary>(`/api/groups/${groupId}/summary`);
  },
  listSettlements(groupId: string) {
    return request<Settlement[]>(`/api/groups/${groupId}/settlements`);
  },
  createSettlement(groupId: string, body: { fromMemberId: string; toMemberId: string; amountMinor: number; date: string }) {
    return request<Settlement>(`/api/groups/${groupId}/settlements`, { method: "POST", body: JSON.stringify(body) });
  },
  deleteSettlement(groupId: string, settlementId: string) {
    return request<void>(`/api/groups/${groupId}/settlements/${settlementId}`, { method: "DELETE" });
  },
};
