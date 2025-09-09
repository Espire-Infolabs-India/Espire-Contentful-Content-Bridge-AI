// src/utils/flattenSchemas.ts
/**
 * Convert content type schema list into normalized list for backend matching and traversal.
 */
export function flattenSchemas(schemaList: any[]): any[] {
  const result: any[] = [];
  const visited = new Set<string>();
  const queue: any[] = Array.isArray(schemaList) ? [...schemaList] : [];

  while (queue.length) {
    const schema = queue.shift();
    if (!schema?.id || visited.has(schema.id)) continue;

    visited.add(schema.id);
    result.push({
      id: schema.id,
      name: schema.name,
      type: schema.type || schema.data_type || "Object",
      fields: schema.fields || schema.schema || [],
      validations: schema.validations || [],
      items: schema.items || {},
      linkContentType:
        schema.linkContentType ||
        schema?.validations?.[0]?.linkContentType ||
        schema?.items?.validations?.[0]?.linkContentType ||
        [],
    });

    if (schema.data_type === "global_field" && Array.isArray(schema.schema)) {
      for (const subSchema of schema.schema) {
        if (subSchema?.id && !visited.has(subSchema.id)) {
          queue.push({
            id: subSchema.id,
            fields: subSchema.fields || [],
            type: subSchema.type || "Object",
          });
        }
      }
    }

    if (Array.isArray(schema.fields)) {
      for (const field of schema.fields) {
        const nestedTypeIds =
          field?.validations?.[0]?.linkContentType ||
          field?.items?.validations?.[0]?.linkContentType;
        if (Array.isArray(nestedTypeIds)) {
          for (const nestedId of nestedTypeIds) {
            const nestedSchema = schemaList.find((s) => s.id === nestedId);
            if (nestedSchema && !visited.has(nestedId)) {
              queue.push(nestedSchema);
            } else if (!nestedSchema) {
              console.warn(" Missing schema for nested content type:", nestedId);
            }
          }
        }
      }
    }
  }

  return result;
}
