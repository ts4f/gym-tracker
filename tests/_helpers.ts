export function nn<T>(value: T | undefined | null, message = "expected non-null value"): T {
  if (value === undefined || value === null) {
    throw new Error(message);
  }
  return value;
}
