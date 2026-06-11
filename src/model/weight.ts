import { Unit, Weight } from "./types";

const LB_PER_KG = 2.2046226218;

export function toKg(weight: Weight): number {
  if (weight.unit === "kg") return weight.value;
  return weight.value / LB_PER_KG;
}

export function toLb(weight: Weight): number {
  if (weight.unit === "lb") return weight.value;
  return weight.value * LB_PER_KG;
}

export function format(weight: Weight, fractionDigits = 1): string {
  const rounded = Number(weight.value.toFixed(fractionDigits));
  const v = Number.isInteger(rounded) ? String(rounded) : rounded.toString();
  return `${v}${weight.unit}`;
}

const TOKEN_RE = /^\+?(\d+(?:\.\d+)?)(kg|lb)?$/i;

export function parseWeightToken(
  token: string,
  defaultUnit: Unit,
): Weight | null {
  const match = TOKEN_RE.exec(token.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = (match[2]?.toLowerCase() as Unit | undefined) ?? defaultUnit;
  return { value, unit };
}
