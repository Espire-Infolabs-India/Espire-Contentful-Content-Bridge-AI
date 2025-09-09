// src/utils/collectFormFields.ts
import { Field } from "../types";

/**
 * Collect textareas, checkboxes and dropdowns from DOM into Field[]
 * (Preserves original behaviors.)
 */
export function collectFormFields(): Field[] {
  const fieldsToSend: Field[] = [];

  // Textareas
  document
    .querySelectorAll<HTMLTextAreaElement>("textarea.form-textarea")
    .forEach((t) => {
      if (t.name && t.value) {
        fieldsToSend.push({
          key: t.name,
          actual_key: t.name,
          value: t.value,
        });
      }
    });

  // Checkboxes (multi-select groups)
  document
    .querySelectorAll<HTMLInputElement>("input[type='checkbox'].form-checkbox")
    .forEach((c) => {
      if (c.name && c.checked) {
        const existing = fieldsToSend.find((f) => f.key === c.name);
        if (existing) {
          existing.value = Array.isArray(existing.value)
            ? [...existing.value, c.value]
            : [existing.value, c.value];
        } else {
          fieldsToSend.push({
            key: c.name,
            actual_key: c.name,
            value: [c.value],
          });
        }
      }
    });

  // Dropdowns (basic handling; assetReferences can be handled elsewhere)
  document
    .querySelectorAll<HTMLSelectElement>("select.form-dropdown")
    .forEach((s) => {
      if (s.name && s.value) {
        // If you later want to treat some dropdowns as asset links, do that before calling create entry.
        fieldsToSend.push({
          key: s.name,
          actual_key: s.name,
          value: s.value,
        });
      }
    });

  return fieldsToSend;
}
