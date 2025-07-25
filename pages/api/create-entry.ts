import axios from "axios";
import { BLOCKS } from "@contentful/rich-text-types";
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
  publish: boolean,
  nestedSchema: any[]
) => {
  const normalizedFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    const schemaField = nestedSchema.find(
      (f: any) => f.id === key || f.uid === key
    );
    normalizedFields[key] = normalizeValueForContentful(value, schemaField);
  }

  const payload = {
    fields: wrapFieldsWithLocales(normalizedFields),
  };

  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
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
  }
  return {
    sys: {
      id: createdEntry.sys.id,
      type: "Link",
      linkType: "Entry",
    },
  };
};
export const createContentfulEntry = async (
  fields: Field[],
  contentTypeId: string,
  publish: boolean = false,
  contentTypeSchemas: ContentTypeSchema[] = [],
  incomingNestedSchemas: Record<
    string,
    { contentTypeId: string; entries: any[] }
  > = {}
) => {
  console.log(
    " Creating Contentful entry with contentTypeId:",
    contentTypeId
  );
  try {
    const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
    const payload: { fields: { [key: string]: { "en-US": any } } } = {
      fields: {},
    };

    // 👇 Prepare schema references
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

    // Remove flattened subfield keys
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

    fields.forEach((field) => {
      const key = field.actual_key;
      if (/\[[0-9]+\]\[.+\]/.test(key)) return;
      if (
        field.value === undefined ||
        field.value === null ||
        field.value === ""
      )
        return;

      try {
        const schemaField = allSchemaObjects.find(
          (s) => s.id === key || s.uid === key
        );
        const normalizedValue = normalizeValueForContentful(
          field.value,
          schemaField
        );

        // handle arrays of links
        if (
          Array.isArray(normalizedValue) &&
          normalizedValue.every((v) => v?.sys?.id)
        ) {
          payload.fields[key] = { "en-US": normalizedValue };
          return;
        }

        // handle author or link-like fields
        if (
          typeof normalizedValue === "object" &&
          normalizedValue?.sys?.id &&
          normalizedValue?.sys?.linkType
        ) {
          payload.fields[key] = { "en-US": normalizedValue };
          return;
        }

        // default case (text, symbol, richtext)
        payload.fields[key] = { "en-US": normalizedValue };
      } catch (err: any) {
        const errorMessage = (err as Error)?.message || JSON.stringify(err);
        console.warn(
          `⚠️ Skipping field "${key}" due to normalization error:`,
          errorMessage
        );

        if (key === "description") {
          console.warn(
            "⚠️ Skipping 'description' field to avoid RichText issue."
          );
        }
      }
    });

    // ✅ ADD THIS BLOCK EARLY TO DETECT FLAT ARRAYS
    for (const field of fields) {
      const { actual_key, value } = field;

      console.log(`🔍 Scanning field: ${actual_key}`);
      if (Array.isArray(value)) {
        console.log(
          `🔎 Field ${actual_key} is an array with ${value.length} items`
        );
        console.log(`📦 Sample value[0]:`, value[0]);
      }

      if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null &&
        !value[0]?.sys // exclude already-linked items
      ) {
        // Look for a schema field matching this array key
        const schemaField =
          allSchemaObjects.find(
            (s) => s.id === actual_key || s.uid === actual_key
          ) || {};
        let nestedContentTypeId: string | undefined = undefined;

        // linkContentType in items.validations (for Array fields)
        if (schemaField?.items?.validations) {
          const validations = schemaField.items.validations as any[];
          const match = validations.find((v) =>
            Array.isArray(v.linkContentType)
          );
          if (match?.linkContentType?.[0]) {
            nestedContentTypeId = match.linkContentType[0];
          }
        }

        // linkContentType in validations (for Entry fields)
        if (!nestedContentTypeId && schemaField?.validations) {
          const validations = schemaField.validations as any[];
          const match = validations.find((v) =>
            Array.isArray(v.linkContentType)
          );
          if (match?.linkContentType?.[0]) {
            nestedContentTypeId = match.linkContentType[0];
          }
        }

        // Direct linkContentType (sometimes present in normalized schema)
        if (!nestedContentTypeId) {
          if (Array.isArray(schemaField.linkContentType)) {
            nestedContentTypeId = schemaField.linkContentType[0];
          } else if (typeof schemaField.linkContentType === "string") {
            nestedContentTypeId = schemaField.linkContentType;
          }
        }

        if (!nestedContentTypeId) {
          console.warn(
            `⚠️ Skipping ${actual_key} — no linkContentType found in schema`
          );
          continue;
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
    //  Build nestedSchemas structure
    const builtNestedSchemas = Object.entries(groupedArrayFields).reduce(
      (acc, [key, entries]) => {
        const schemaField = allSchemaObjects.find(
          (s) =>
            s.id === key &&
            s.type === "Array" &&
            s.validations?.some(
              (v: any) =>
                Array.isArray(v.linkContentType) && v.linkContentType.length > 0
            )
        );

        const contentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0];
        let nestedFields = schemaField?.nestedFields;

        if (!nestedFields && contentTypeId) {
          const childType =
            contentTypeSchemas.find((c) => c.id === contentTypeId) ||
            rootGlobalFieldsArray.find(
              (s) => s?.uid === contentTypeId || s?.id === contentTypeId
            );

          nestedFields = childType?.fields || childType?.schema || [];
        }
        if (!contentTypeId || !nestedFields?.length) return acc;

        const structured = entries.map((entryItem: any) => {
          const obj: Record<string, any> = {};
          nestedFields.forEach((nf: any) => {
            const raw = entryItem[nf.id];
            obj[nf.id] =
              typeof raw === "object" && "value" in raw ? raw.value : raw;
          });
          return obj;
        });

        acc[key] = { entries: structured, contentTypeId };
        return acc;
      },
      {} as Record<string, { contentTypeId: string; entries: any[] }>
    );
    const nestedSchemas = { ...incomingNestedSchemas, ...builtNestedSchemas };
    // Create all nested entries first
    const nestedEntryLinks: Record<string, any[]> = {};
    for (const [fieldKey, schema] of Object.entries(nestedSchemas)) {
      if (!Array.isArray(schema.entries)) continue;
      nestedEntryLinks[fieldKey] = [];
      for (const entryFields of schema.entries) {
        const nestedSchema =
          contentTypeSchemas.find((c) => c.id === schema.contentTypeId)
            ?.fields ||
          rootGlobalFieldsArray.find((g) => g.uid === schema.contentTypeId)
            ?.schema ||
          [];

        const nestedEntry = await createNestedEntry(
          schema.contentTypeId,
          entryFields,
          publish,
          nestedSchema
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
        field.value = links;
      }
    }
    payload.fields = {};

    fields.forEach((field) => {
      const key = field.actual_key;
      const value = field.value;

      // Skip invalid keys or empty values
      if (/\[[0-9]+\]\[.+\]/.test(key)) return;
      if (value === undefined || value === null || value === "") return;
      const schemaField = contentTypeSchemas.find((f) => f.id === key);
      const expectedType = schemaField?.type;

      try {
        // ✅ Handle arrays of links
        if (Array.isArray(value) && value.every((v) => v?.sys?.id)) {
          payload.fields[key] = { "en-US": value };
          return;
        }

        // ✅ Handle single link
        if (typeof value === "object" && value?.sys?.id) {
          payload.fields[key] = {
            "en-US": {
              sys: {
                type: "Link",
                linkType:
                  value.sys.linkType || (key === "image" ? "Asset" : "Entry"),
                id: value.sys.id,
              },
            },
          };
          return;
        }

        // ✅ RichText: convert plain string to valid RichText
        if (expectedType === "RichText") {
          if (
            typeof value === "object" &&
            value?.nodeType === "document" &&
            Array.isArray(value.content)
          ) {
            payload.fields[key] = { "en-US": value }; // already valid RichText
          } else if (typeof value === "string") {
            payload.fields[key] = { "en-US": convertToRichText(value) }; // convert to RichText
          } else {
            console.warn(
              `⚠️ Skipping invalid RichText value for field "${key}"`
            );
          }
          return;
        }

        // ✅ Fallback for all other simple types
        payload.fields[key] = { "en-US": value };
      } catch (err: any) {
        console.warn(
          `❌ Error normalizing field "${key}":`,
          err?.message || err
        );
      }
    });

    // ✅ STEP 4: Create main entry
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": contentTypeId,
      },
    });

    const createdMainEntry = response.data;

    // ✅ STEP 5: Publish main entry if required
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
      "❌ Error creating entry:",
      error?.response?.data || error?.message || error
    );
    throw error;
  }
};
