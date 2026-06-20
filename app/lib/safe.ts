export function safeArr<T>(val: T[] | null | undefined): T[] {
  return Array.isArray(val) ? val : [];
}
