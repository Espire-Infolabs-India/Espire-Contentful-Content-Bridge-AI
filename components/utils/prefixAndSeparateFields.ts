// src/utils/prefixAndSeparateFields.ts
import { Field } from "../types";

export function prefixAndSeparateFields(
  fieldsToSendInput: Field[],
  allSchemaObjects: any[]
): {
  remainingParentFields: Field[];
  childEntriesToCreate: Record<string, Field[]>;
  childToParents: Map<string, string[]>;
} {
  const fieldsToSend = Array.isArray(fieldsToSendInput)
    ? [...fieldsToSendInput]
    : [];

  // ✅ Normalize keys first: strip `_root` including optional array index
  const normalizedFields = fieldsToSend.map((f) => {
    if (!f) return f;
    let cleanActualKey =
      typeof f.actual_key === "string" ? f.actual_key : f.actual_key;
    let cleanKey = typeof f.key === "string" ? f.key : f.key;

    // Remove _root or _root[0], _root[4], etc.
    cleanActualKey = cleanActualKey.replace(/^_root(?:\[\d+\])?\./, "");
    cleanKey = cleanKey.replace(/^_root(?:\[\d+\])?\./, "");

    return { ...f, actual_key: cleanActualKey, key: cleanKey };
  });

  const childToParents = new Map<string, string[]>();

  function extractLinkedTypes(obj: any): string[] {
    const set = new Set<string>();
    if (!obj) return [];
    if (Array.isArray(obj.linkContentType))
      obj.linkContentType.forEach((v: string) => v && set.add(v));
    if (Array.isArray(obj.validations)) {
      for (const v of obj.validations)
        if (Array.isArray(v.linkContentType))
          v.linkContentType.forEach((t: string) => t && set.add(t));
    }
    if (obj.items && Array.isArray(obj.items.validations)) {
      for (const v of obj.items.validations)
        if (Array.isArray(v.linkContentType))
          v.linkContentType.forEach((t: string) => t && set.add(t));
    }
    return Array.from(set);
  }

  for (const schemaObj of allSchemaObjects || []) {
    const parentId = schemaObj?.id;
    if (!parentId) continue;
    const linked = extractLinkedTypes(schemaObj);
    for (const child of linked) {
      const arr = childToParents.get(child) || [];
      if (!arr.includes(parentId)) arr.push(parentId);
      childToParents.set(child, arr);
    }
  }

  // nestedFieldToParent mapping
  const nestedFieldToParent = new Map<string, string>();
  function mapNestedFields(schemaList: any[], parentPrefix = "") {
    for (const schema of schemaList || []) {
      const parentId = parentPrefix || schema.id;
      if (!parentId || !schema.fields) continue;

      for (const field of schema.fields) {
        if (!field.id) continue;

        // ✅ Skip "_root" as a parent
        if (parentPrefix && parentPrefix !== "_root") {
          nestedFieldToParent.set(field.id, parentPrefix);
        }

        if (Array.isArray(field.fields) && field.fields.length) {
          mapNestedFields(
            [{ ...field, id: field.id, fields: field.fields }],
            parentId
          );
        }
      }
    }
  }
  mapNestedFields(allSchemaObjects);

  const stripArrayIndex = (segment: string) => segment.replace(/\[\d+\]/g, "");

  // prefixing
  const prefixed = normalizedFields.map((f) => {
    if (!f?.actual_key || typeof f.actual_key !== "string") return f;
    const parts = f.actual_key.split(".").map(stripArrayIndex);
    const root = parts[0];
    const parentsFromChildMap = childToParents.get(root) || [];
    const parentFromNestedMap = nestedFieldToParent.get(root);
    const parent = parentsFromChildMap[0] || parentFromNestedMap;

    // ✅ Again, skip `_root` and do not re-prefix root-level fields
    if (!parent || parent === "_root" || parent === root || f.actual_key.startsWith(`${parent}.`)) {
      return f;
    }

    const newActualKey = `${parent}.${f.actual_key}`;
    const newKey = f.key ? `${parent}.${f.key}` : newActualKey;
    return { ...f, actual_key: newActualKey, key: newKey };
  });

  const childEntriesToCreate: Record<string, Field[]> = {};
  const remainingParentFields: Field[] = [];

  for (const f of prefixed) {
    if (!f?.actual_key) continue;
    const parts = f.actual_key.split(".").map(stripArrayIndex);
    const childTypeIndex = parts.findIndex((p) => childToParents.has(p));
    if (childTypeIndex !== -1) {
      const childType = parts[childTypeIndex];
      if (!childEntriesToCreate[childType]) childEntriesToCreate[childType] = [];
      const newActualKey = parts.slice(childTypeIndex + 1).join(".");
      const newKey = f.key?.split(".").slice(childTypeIndex + 1).join(".");
      childEntriesToCreate[childType].push({
        ...f,
        actual_key: newActualKey,
        key: newKey,
      });
    } else {
      remainingParentFields.push(f);
    }
  }

  return { remainingParentFields, childEntriesToCreate, childToParents };
}
