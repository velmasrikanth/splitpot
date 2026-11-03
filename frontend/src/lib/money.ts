const SCALE = 100;

export function minorToDecimal(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const major = Math.floor(absolute / SCALE);
  const minor = String(absolute % SCALE).padStart(2, "0");
  return `${sign}${major}.${minor}`;
}

export function decimalToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const minor = Number(whole) * SCALE + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 1_000_000_000) {
    return null;
  }
  return minor;
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(minorToDecimal(amountMinor)));
}

export function percentToBasisPoints(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isInteger(basisPoints) || basisPoints <= 0 || basisPoints > 10_000) {
    return null;
  }
  return basisPoints;
}

export function basisPointsToInput(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  if (fraction === 0) {
    return String(whole);
  }
  const digits = String(fraction).padStart(2, "0").replace(/0$/, "");
  return `${whole}.${digits}`;
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}
