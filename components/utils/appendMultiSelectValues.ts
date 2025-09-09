// src/utils/appendMultiSelectValues.ts
import { Field } from "../props";
export function appendMultiSelectValues(
  fieldsToSend: Field[],
  multiSelectValues: Record<string, any[]> | undefined,
  result: any,
  getFullPathFromResult: (result: any, key: string) => string
): void {
  if (!multiSelectValues) return;

  Object.entries(multiSelectValues).forEach(([key, selectedValues]) => {
    if (selectedValues && selectedValues.length) {
      const fullPath = getFullPathFromResult(result, key) || key;
      fieldsToSend.push({
        key,
        actual_key: fullPath,
        value: Array.isArray(selectedValues) ? selectedValues : [selectedValues],
      });
    }
  });
}
