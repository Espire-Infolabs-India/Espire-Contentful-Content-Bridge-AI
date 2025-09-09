// src/utils/appendNestedImages.ts
import { Field } from "../types";

/**
 * Push uploaded image and nested images (from nestedSchemas) into fieldsToSend.
 */
export function appendNestedImages(
  fieldsToSend: Field[],
  uploadedImageId: string | undefined,
  nestedSchemas: Record<string, any>
): void {
  if (uploadedImageId) {
    fieldsToSend.push({
      key: "image",
      actual_key: "image",
      value: { sys: { id: uploadedImageId, linkType: "Asset", type: "Link" } },
    });
  }

  if (!nestedSchemas || typeof nestedSchemas !== "object") return;

  Object.entries(nestedSchemas).forEach(([schemaKey, schema]) => {
    const entries = Array.isArray(schema?.entries) ? schema.entries : [];
    entries.forEach((entry: any, entryIndex: number) => {
      const fields = Array.isArray(entry.fields) ? entry.fields : [];
      for (const field of fields) {
        if (field?.value?.sys?.linkType === "Asset" && field.value.sys.id) {
          const nestedKey = `${schemaKey}[${entryIndex}].${field.actual_key}`;
          fieldsToSend.push({
            key: nestedKey,
            actual_key: nestedKey,
            value: { sys: { ...field.value.sys } },
          });
        }
      }
    });
  });
}
