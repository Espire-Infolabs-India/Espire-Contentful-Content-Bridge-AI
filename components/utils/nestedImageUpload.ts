// utils/nestedHelpers.ts
import { RefObject, Dispatch, SetStateAction } from "react";

export interface NestedField {
     key?: string; // make it optional
  actual_key: string;
  value: any;
}

export interface NestedEntry {
  fields: NestedField[];
}

export interface NestedSchema {
  entries: NestedEntry[];
}

export interface HandleNestedImageUploadParams {
  file: File;
  schemaKey: string;
  entryIndex: number;
  fieldKey: string;
  nestedSchemas: Record<string, NestedSchema>;
  setNestedSchemas: Dispatch<SetStateAction<Record<string, NestedSchema>>>;
  fieldsToSendRef: RefObject<NestedField[]>;
  handleFileUpload: (file: File) => Promise<string | null>;
}

export const handleNestedImageUpload = async ({
  file,
  schemaKey,
  entryIndex,
  fieldKey,
  nestedSchemas,
  setNestedSchemas,
  fieldsToSendRef,
  handleFileUpload,
}: HandleNestedImageUploadParams) => {
  const previewUrl = URL.createObjectURL(file);

  // 1️⃣ Update preview immediately
  setNestedSchemas((prev) => {
    const updated = structuredClone(prev);
    let schema = updated[schemaKey];

    if (!schema) {
      schema = { entries: [] };
      updated[schemaKey] = schema;
    }

    while (!schema.entries[entryIndex]) {
      schema.entries.push({ fields: [] });
    }

    const entry = schema.entries[entryIndex];
    if (!Array.isArray(entry.fields)) entry.fields = [];

    let field = entry.fields.find((f) => f.actual_key === fieldKey);
    if (!field) {
      field = { actual_key: fieldKey, value: null };
      entry.fields.push(field);
    }

    field.value = {
      sys: { id: "preview", type: "Link", linkType: "Asset" },
      _preview: { url: previewUrl, title: file.name + " (preview)" },
    };

    return updated;
  });

  try {
    // 2️⃣ Upload file
    const assetId = await handleFileUpload(file);
    if (!assetId) return;

    // 3️⃣ Push uploaded asset to fieldsToSendRef (safely)
    if (fieldsToSendRef?.current) {
      fieldsToSendRef.current.push({
        key: `${schemaKey}[${entryIndex}].${fieldKey}`,
        actual_key: `${schemaKey}[${entryIndex}].${fieldKey}`,
        value: { sys: { id: assetId, linkType: "Asset", type: "Link" } },
      });
    } else {
      console.warn("fieldsToSendRef.current is null, cannot push asset.");
    }

    // 4️⃣ Update nestedSchemas with actual asset ID but keep preview
    setNestedSchemas((prev) => {
      const updated = structuredClone(prev);
      const schema = updated[schemaKey];
      if (!schema || !Array.isArray(schema.entries)) return prev;

      const updatedEntries = schema.entries.map((entry, i) => {
        if (i !== entryIndex) return entry;

        const updatedFields = entry.fields.map((field) => {
          if (field.actual_key === fieldKey) {
            return {
              ...field,
              value: {
                sys: { id: assetId, linkType: "Asset", type: "Link" },
                _preview: field.value._preview,
              },
            };
          }
          return field;
        });

        return { ...entry, fields: updatedFields };
      });

      updated[schemaKey] = { ...schema, entries: updatedEntries };
      return updated;
    });
  } catch (err) {
    console.error("❌ Upload failed", err);
  }
};
