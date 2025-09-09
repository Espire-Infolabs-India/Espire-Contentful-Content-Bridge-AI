// src/utils/getFullPathFromResult.ts

export function getFullPathFromResult(result: any, key: string): string {
  if (!result || typeof result !== "object") return key;

  for (const groupKey in result) {
    const group = result[groupKey];
    if (Array.isArray(group)) {
      for (const field of group) {
        if (field && field.actual_key === key) {
          // field.key is the full dot-notation path in your original code
          return field.key || key;
        }
      }
    }
  }
  return key;
}
