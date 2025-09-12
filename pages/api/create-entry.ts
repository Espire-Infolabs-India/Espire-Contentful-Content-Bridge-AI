import axios from "axios";
const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
const managementToken = process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN;

interface Field {
  actual_key: string;
  value: any;
}

interface ContentfulField {
  id: string;
  type: string;
  items?: {
    type?: string;
    validations?: {
      linkContentType?: string[];
    }[];
  };
  validations?: {
    linkContentType?: string[];
  }[];
  nestedFields?: any[];
  uid?: string;
}

interface ContentTypeSchema {
  id: string;
  type: string;
  fields: ContentfulField[];
  uid?: string;
  display_name?: string;
  data_type?: string;
  schema?: {
    id: string;
    type: string;
    validations?: any[];
    [key: string]: any;
  }[];
}

function convertToRichText(text: string) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        content: [
          {
            nodeType: "text",
            value: text,
            marks: [],
            data: {},
          },
        ],
        data: {},
      },
    ],
  };
}

// Recursively inject user-selected entries into fields
function injectUserSelections(
  fields: any[],
  multiSelectValues: Record<string, string[]>
) {
  for (const field of fields) {
    // Recurse into arrays
    if (Array.isArray(field.value)) {
      field.value.forEach(
        (item: { [s: string]: unknown } | ArrayLike<unknown> | null) => {
          if (typeof item === "object" && item !== null) {
            injectUserSelections(
              Object.entries(item).map(([k, v]) => ({
                actual_key: k,
                value: v,
              })),
              multiSelectValues
            );
          }
        }
      );
    }

    // Inject user-selected entries
    const selectedIds = multiSelectValues[field.actual_key];
    if (selectedIds && selectedIds.length > 0) {
      field.value = selectedIds.map((id) => ({
        sys: { type: "Link", linkType: "Entry", id },
      }));
    }
  }
}

function normalizeValueForContentful(value: any, schemaField: any) {
  if (!schemaField) return value;
  const type = schemaField.type;
  if (type === "RichText" && typeof value === "string") {
    return convertToRichText(value);
  }
  if (
    (type === "Text" || type === "Symbol") &&
    typeof value === "object" &&
    "value" in value
  ) {
    return value.value;
  }
  if (type === "Asset" && value?.sys?.id) {
    return {
      sys: {
        type: "Link",
        linkType: "Asset",
        id: value.sys.id,
      },
    };
  }
  if (type === "Link" && value?.sys?.id) {
    return {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: value.sys.id,
      },
    };
  }
  if (type === "Array") {
    if (!Array.isArray(value)) {
      value = [value];
    }
    return value;
  }
  return value;
}

const wrapFieldsWithLocales = (fields: Record<string, any>) => {
  const wrapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    wrapped[key] = { "en-US": value };
  }
  return wrapped;
};

const createNestedEntry = async (
  contentTypeId: string,
  fields: Record<string, any>,
  publish: boolean
) => {
  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
  const payload = {
    fields: wrapFieldsWithLocales(fields),
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${managementToken}`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      "X-Contentful-Content-Type": contentTypeId,
    },
  });

  const createdEntry = res.data;
  if (publish) {
    const published = await axios.put(
      `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${createdEntry.sys.id}/published`,
      {},
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "X-Contentful-Version": createdEntry.sys.version,
        },
      }
    );
    return published.data;
  }

  return createdEntry;
};
// Helper: Collect all fields that are Array of Links from schema
function getArrayLinkFields(allSchemaObjects: any[]): string[] {
  const arrayFields: string[] = [];
  for (const schemaField of allSchemaObjects) {
    if (
      schemaField.type === "Array" &&
      schemaField.items?.type === "Link" &&
      schemaField.items?.linkType === "Entry"
    ) {
      arrayFields.push(schemaField.id || schemaField.uid);
    }

    if (Array.isArray(schemaField.schema)) {
      arrayFields.push(...getArrayLinkFields(schemaField.schema));
    }

    if (Array.isArray(schemaField.fields)) {
      arrayFields.push(...getArrayLinkFields(schemaField.fields));
    }
  }

  return arrayFields;
}

export const createContentfulEntry = async (
  fields: Field[],
  contentTypeId: string,
  publish: boolean = false,
  contentTypeSchemas: ContentTypeSchema[] = [],
  incomingNestedSchemas: Record<
    string,
    { contentTypeId: string; entries: any[] }
  > = {},
  multiSelectValues: Record<string, string[]> = {} // ✅ add this
) => {
  try {
    const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
    const payload: { fields: { [key: string]: { "en-US": any } } } = {
      fields: {},
    };

    // Prepare schema references
    let allSchemaObjects: any[] = [...contentTypeSchemas];
    const rootGlobalFields =
      contentTypeSchemas.filter((f) => f.data_type === "global_field") || [];
    const rootGlobalFieldsArray = rootGlobalFields.flatMap((component) =>
      component?.schema?.map((obj: any) => ({
        ...obj,
        parent_uid: component?.uid,
        parent_to_uid: component?.uid,
        parent_title: component?.display_name,
        is_root: true,
      }))
    );
    allSchemaObjects = allSchemaObjects.concat(rootGlobalFieldsArray);
    // STEP 2: Build incomingNestedSchemas from both array-style and direct nested object values
    const groupedArrayFields = fields.reduce((acc, field) => {
      const match = field.actual_key.match(
        /^([a-zA-Z0-9_]+)\[(\d+)\]\[([a-zA-Z0-9_]+)\]$/
      );
      if (match) {
        const [_, arrayKey, index, subKey] = match;
        if (!acc[arrayKey]) acc[arrayKey] = [];
        if (!acc[arrayKey][+index]) acc[arrayKey][+index] = {};
        acc[arrayKey][+index][subKey] =
          typeof field.value === "object" && field.value?.value !== undefined
            ? field.value.value
            : field.value;
      }
      return acc;
    }, {} as Record<string, any[]>);
    //Remove flattened subfield keys
    for (const key of Object.keys(groupedArrayFields)) {
      for (let i = fields.length - 1; i >= 0; i--) {
        if (fields[i].actual_key.startsWith(`${key}[`)) {
          fields.splice(i, 1);
        }
      }
    }

    // Add grouped entries back as flat object-style values
    for (const [key, entries] of Object.entries(groupedArrayFields)) {
      fields.push({ actual_key: key, value: entries });
    }

    // Also handle object-style nested arrays like productPageSeo: [{ title: ..., description: ... }]
    fields.forEach((field) => {
      const { actual_key, value } = field;
      const alreadyGrouped = groupedArrayFields[actual_key];
      if (
        !alreadyGrouped &&
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null
      ) {
        groupedArrayFields[actual_key] = value;
      }
    });

    // Dynamically detect array-of-link fields from schema
    const arrayLinkFields = getArrayLinkFields(allSchemaObjects);
    for (const field of fields) {
      const { actual_key, value } = field;
      if (Array.isArray(value)) {
      }

      if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        !value[0]?.sys
      ) {
        const schemaField =
          allSchemaObjects.find(
            (s) => s.id === actual_key || s.uid === actual_key
          ) || {};
        const nestedContentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0] ||
          schemaField?.linkContentType?.[0] ||
          schemaField?.items?.linkContentType?.[0] ||
          schemaField?.items?.validations?.[0]?.linkContentType?.[0];

        if (!nestedContentTypeId) {
          if (!incomingNestedSchemas[actual_key]) {
            incomingNestedSchemas[actual_key] = {
              contentTypeId: "__unknown__",
              entries: [],
            };
          }
        }

        if (nestedContentTypeId === contentTypeId) {
          console.warn(
            ` Nested contentTypeId matches parent for "${actual_key}". This might be intentional (self-reference).`
          );
        }

        if (!incomingNestedSchemas[actual_key]) {
          incomingNestedSchemas[actual_key] = {
            contentTypeId: nestedContentTypeId,
            entries: [],
          };
        }
        for (const entry of value) {
          if (typeof entry === "object" && entry !== null) {
            incomingNestedSchemas[actual_key].entries.push(entry);
          }
        }
      }
    }
    // Build nestedSchemas structure
    const builtNestedSchemas = Object.entries(groupedArrayFields).reduce(
      (acc, [key, entries]) => {
        const schemaField = allSchemaObjects.find(
          (s) =>
            s.id === key &&
            ((s.type === "Link" && s.linkType === "Entry") ||
              (s.type === "Array" &&
                s.items?.type === "Link" &&
                s.items?.linkType === "Entry"))
        );

        if (!schemaField) {
          return acc;
        }
        const contentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0] ||
          schemaField?.items?.validations?.[0]?.linkContentType?.[0];

        if (!contentTypeId) {
          console.warn(` No linked content type found for "${key}"`);
          return acc;
        }

        // Attempt to resolve nestedFields
        let nestedFields = schemaField?.nestedFields;
        if (!nestedFields && contentTypeId) {
          const childType =
            contentTypeSchemas.find((c) => c.id === contentTypeId) ||
            rootGlobalFieldsArray.find(
              (s) => s?.uid === contentTypeId || s?.id === contentTypeId
            );

          nestedFields = childType?.fields || childType?.schema || [];
        }
        if (!nestedFields?.length) {
          console.warn(
            ` No nested fields found for "${key}" (contentTypeId: "${contentTypeId}")`
          );
          return acc;
        }

        const structured = entries.map((entryItem: any) => {
          const obj: Record<string, any> = {};
          nestedFields.forEach((nf: any) => {
            const raw = entryItem[nf.id];
            obj[nf.id] =
              typeof raw === "object" && raw !== null && "value" in raw
                ? raw.value
                : raw;
          });
          return obj;
        });

        acc[key] = { entries: structured, contentTypeId };
        return acc;
      },
      {} as Record<string, { contentTypeId: string; entries: any[] }>
    );

    const nestedSchemas = { ...incomingNestedSchemas, ...builtNestedSchemas };

    // STEP 1: Create all nested entries first
    const nestedEntryLinks: Record<string, any[]> = {};
    for (const [fieldKey, schema] of Object.entries(nestedSchemas)) {
      if (!Array.isArray(schema.entries)) continue;
      if (!nestedEntryLinks[fieldKey]) nestedEntryLinks[fieldKey] = [];
      for (const entryFields of schema.entries) {
        //Step 3A: Inject user selections for Link-type fields
        const selectedIds = multiSelectValues[fieldKey]; // array of selected entry IDs
        if (selectedIds && selectedIds.length > 0) {
          for (const [nestedFieldKey, nestedFieldValue] of Object.entries(
            entryFields
          )) {
            const schemaField = contentTypeSchemas
              .flatMap((s) => s.fields)
              .find(
                (f) =>
                  f.id === nestedFieldKey || (f as any).uid === nestedFieldKey
              );
            if (!schemaField) continue;
            if (schemaField.type === "Link") {
              // Single reference
              entryFields[nestedFieldKey] = {
                sys: { type: "Link", linkType: "Entry", id: nestedFieldValue },
              };
            } else if (
              schemaField.type === "Array" &&
              schemaField.items?.type === "Link"
            ) {
              // Array of references
              const ids = Array.isArray(nestedFieldValue)
                ? nestedFieldValue
                : [nestedFieldValue];
              entryFields[nestedFieldKey] = ids.map((id) => ({
                sys: { type: "Link", linkType: "Entry", id },
              }));
            }
          }
        }

        const nestedEntry = await createNestedEntry(
          schema.contentTypeId,
          entryFields,
          publish
        );
        nestedEntryLinks[fieldKey].push({
          sys: {
            type: "Link",
            linkType: "Entry",
            id: nestedEntry.sys?.id,
          },
        });
      }
    }
    for (const [fieldKey, links] of Object.entries(nestedEntryLinks)) {
      const field = fields.find((f) => f.actual_key === fieldKey);
      if (field) {
        if (!Array.isArray(field.value)) field.value = [];
        field.value = field.value.concat(links);
      }
    }

    fields.forEach((field) => {
      const key = field.actual_key;
      if (/\[[0-9]+\]\[.+\]/.test(key)) return;
      if (
        field.value === undefined ||
        field.value === null ||
        field.value === ""
      )
        return;
      const schemaField = allSchemaObjects.find(
        (s) => s.id === key || s.uid === key
      );
      const normalizedValue = normalizeValueForContentful(
        field.value,
        schemaField
      );
      payload.fields[key] = { "en-US": normalizedValue };
    });
    const mergedFieldsMap: Record<string, any> = {};

    for (const field of fields) {
      if (field.actual_key === "componentContainer") {
        if (!mergedFieldsMap[field.actual_key]) {
          mergedFieldsMap[field.actual_key] = [];
        }
        if (Array.isArray(field.value)) {
          mergedFieldsMap[field.actual_key].push(...field.value);
        } else {
          mergedFieldsMap[field.actual_key].push(field.value);
        }
      } else {
        mergedFieldsMap[field.actual_key] = field.value;
      }
    }
    const finalFields = Object.entries(mergedFieldsMap).map(([key, value]) => ({
      key,
      actual_key: key,
      value,
    }));
    // Build payload from finalFields
    const finalPayload = {
      fields: finalFields.reduce((acc, field) => {
        let value = field.value;
        // normalize numbers
        if (
          !isNaN(value) &&
          value !== "" &&
          value !== null &&
          value !== undefined
        ) {
          value = Number(value);
        }
        if (value === "true" || value === true) {
          value = true;
        } else if (value === "false" || value === false) {
          value = false;
        }
        acc[field.actual_key] = { "en-US": value };
        return acc;
      }, {} as Record<string, any>),
    };

    function normalizeFields(fields: Record<string, any>, parentKey = "") {
      for (const [key, fieldValue] of Object.entries(fields)) {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;

        if (
          fieldValue &&
          typeof fieldValue === "object" &&
          fieldValue["en-US"] !== undefined
        ) {
          let value = fieldValue["en-US"];
          const schemaField = allSchemaObjects.find(
            (s) => s.id === key || s.uid === key
          );

          if (
            (schemaField?.type === "RichText" ||
              ["description", "content", "shortBio"].includes(key)) &&
            typeof value === "string"
          ) {
            fieldValue["en-US"] = {
              nodeType: "document",
              data: {},
              content: [
                {
                  nodeType: "paragraph",
                  data: {},
                  content: [
                    {
                      nodeType: "text",
                      value: value,
                      marks: [],
                      data: {},
                    },
                  ],
                },
              ],
            };
            continue;
          }
          if (
            Array.isArray(value) &&
            value.every((v) => typeof v === "string")
          ) {
            if (key === "cta" || fieldValue.actual_key === "cta") {
              fieldValue["en-US"] = {
                sys: { type: "Link", linkType: "Entry", id: value[0] },
              };
            } else {
              fieldValue["en-US"] = value.map((id) => ({
                sys: { type: "Link", linkType: "Entry", id },
              }));
            }
            continue;
          }
          // Date normalization
          if (
            (schemaField?.type === "Date" ||
              key.toLowerCase().includes("date")) &&
            typeof value === "string"
          ) {
            let parsedDate: Date | null = null;
            const raw = value.trim();

            try {
              const parts = raw.split(/[-/]/);
              if (parts.length === 3 && /^\d+$/.test(parts[0])) {
                const [day, month, year] = parts;
                parsedDate = new Date(
                  `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
                );
              }
              if (!parsedDate || isNaN(parsedDate.getTime())) {
                parsedDate = new Date(raw);
              }
              if (parsedDate && !isNaN(parsedDate.getTime())) {
                fieldValue["en-US"] = parsedDate.toISOString().split("T")[0];
              } else {
                console.warn(
                  ` Could not parse date field "${fullKey}": "${raw}", leaving as-is`
                );
              }
            } catch (err) {
              console.error(` Failed to normalize date for "${fullKey}":`, err);
            }
          }
          // Array normalization (including comma-split strings)
          if (schemaField?.type === "Array" && !Array.isArray(value)) {
            console.log(` Normalizing field "${fullKey}" to array`);
            if (typeof value === "string" && value.includes(",")) {
              fieldValue["en-US"] = value.split(",").map((v) => v.trim());
            } else {
              fieldValue["en-US"] = [value];
            }
          }

          // Link normalization
          if (
            schemaField?.type === "Link" &&
            typeof fieldValue["en-US"] === "string"
          ) {
            fieldValue["en-US"] = {
              sys: { type: "Link", linkType: "Entry", id: fieldValue["en-US"] },
            };
          }
          if (
            schemaField?.type === "Array" &&
            schemaField.items?.type === "Link"
          ) {
            fieldValue["en-US"] = fieldValue["en-US"].map((id: any) =>
              typeof id === "string"
                ? { sys: { type: "Link", linkType: "Entry", id } }
                : id
            );
          }
        }

        // Recurse into nested objects
        if (
          fieldValue &&
          typeof fieldValue === "object" &&
          !Array.isArray(fieldValue)
        ) {
          normalizeFields(fieldValue, fullKey);
        }
      }
    }

    // Call recursive normalizer BEFORE sending payload
    normalizeFields(finalPayload.fields);

    // Create main entry
    const response = await axios.post(url, finalPayload, {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": contentTypeId,
      },
    });

    const createdMainEntry = response.data;
    // Publish main entry if required
    if (publish) {
      const publishResponse = await axios.put(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${createdMainEntry.sys.id}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "X-Contentful-Version": createdMainEntry.sys.version,
          },
        }
      );
      return publishResponse.data;
    }
    return createdMainEntry;
  } catch (error: any) {
    console.error(
      " Error creating entry:",
      error?.response?.data || error?.message || error
    );
    throw error;
  }
};
