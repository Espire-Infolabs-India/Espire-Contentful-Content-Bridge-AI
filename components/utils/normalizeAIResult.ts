// src/utils/normalizeAIResult.ts
import { Field } from "../types";

/**
 * Normalize AI result object / array into fields and append to fieldsToSend.
 * - Uses allowedFields array to filter what to include
 * - Preserves existing fieldsToSend (skips duplicates)
 */
export function normalizeAIResult(
  result: any,
  fieldsToSend: Field[],
  allowedFields: string[]
): void {
  // Convert result to safeResult array structure (same as original)
  let safeResult: any[] = Array.isArray(result)
    ? result
    : Object.entries(result || {})
        .filter(([k]) => isNaN(Number(k)))
        .map(([k, v]) => ({ actual_key: k, key: k, value: v }));

  // exclude top-level parents that already have nested form entries - caller should have appended nested keys first
  const nestedKeysInForm = fieldsToSend.map((f) => f.key).filter((k) => k.includes("["));
  const topLevelKeysToSkip = new Set(nestedKeysInForm.map((k) => k.split("[")[0]));
  const seenKeys = new Set(fieldsToSend.map((f) => f.key));
  safeResult = safeResult.filter((item) => !topLevelKeysToSkip.has(item.key));

  for (const item of safeResult) {
    const alreadyExists = seenKeys.has(item.actual_key);
    if (
      !item.actual_key ||
      item.value === undefined ||
      item.value === null ||
      alreadyExists ||
      !allowedFields.includes(item.actual_key)
    )
      continue;
    seenKeys.add(item.actual_key);

    let finalValue: any = item.value;

    if (item.actual_key === "description" || item.actual_key === "content") {
      if (typeof item.value === "object" && item.value?.nodeType === "document") {
        finalValue = item.value;
      } else {
        finalValue = {
          nodeType: "document",
          data: {},
          content: [
            {
              nodeType: "paragraph",
              data: {},
              content: [
                {
                  nodeType: "text",
                  value: String(item.value || "").trim(),
                  marks: [],
                  data: {},
                },
              ],
            },
          ],
        };
      }
    }

    if (item.actual_key === "tags" && Array.isArray(item.value)) {
      finalValue = item.value.join(", ");
    }

    // The original code skipped arrays as final value for sending
    if (Array.isArray(finalValue)) continue;

    fieldsToSend.push({
      key: item.actual_key,
      actual_key: item.actual_key,
      value: finalValue,
    });
  }
}
