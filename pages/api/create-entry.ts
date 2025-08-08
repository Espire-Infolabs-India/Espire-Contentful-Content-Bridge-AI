
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
  
  if (value === "" || value === null || value === undefined) {
    return undefined; // ✅ Skip invalid values
  }

  const { type, linkType, items } = schemaField;

  // RichText to Document
  if (type === "RichText" && typeof value === "string") {
    return convertToRichText(value);
  }

  // Extract text from value objects
  if (
    (type === "Text" || type === "Symbol") &&
    typeof value === "object" &&
    "value" in value
  ) {
    return value.value;
  }

  // Single Asset
  if (
    (type === "Asset" || (type === "Link" && linkType === "Asset")) &&
    value?.sys?.id
  ) {
    return {
      sys: {
        type: "Link",
        linkType: "Asset",
        id: value.sys.id,
      },
    };
  }

  // Single Entry
  if (type === "Link" && linkType === "Entry" && value?.sys?.id) {
    return {
      sys: {
        type: "Link",
        linkType: "Entry",
        id: value.sys.id,
      },
    };
  }

  // Array of Entries
  if (type === "Array" && items?.linkType === "Entry" && Array.isArray(value)) {
    return value
      .filter((v) => v?.sys?.id)
      .map((v) => ({
        sys: {
          type: "Link",
          linkType: "Entry",
          id: v.sys.id,
        },
      }));
  }

  // Array of Assets
  if (type === "Array" && items?.linkType === "Asset" && Array.isArray(value)) {
    return value
      .filter((v) => v?.sys?.id)
      .map((v) => ({
        sys: {
          type: "Link",
          linkType: "Asset",
          id: v.sys.id,
        },
      }));
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

    console.log("🧩 [createNestedEntry] ▶ contentTypeId:", contentTypeId);
  console.log("🧩 [createNestedEntry] ▶ Raw Fields Input:", fields);
  console.log("🧩 [createNestedEntry] ▶ Nested Schema:", nestedSchema);
//   const normalizedFields: Record<string, any> = {};
//   for (const [key, value] of Object.entries(fields)) {
//     const schemaField = nestedSchema.find(
//       (f: any) => f.id === key || f.uid === key
//     );
//      console.log(
//     `🔧 Normalizing nested field "${key}":`,
//     "raw value =", value,
//     "| schemaField =", schemaField
//   );


//     if (!schemaField) {
//       console.warn(`⚠️ Skipping nested field "${key}" — schema not found`);
//       continue;
//     }
//     normalizedFields[key] = normalizeValueForContentful(value, schemaField);
//   }
// console.log("📦 Final normalized nested fields:", normalizedFields);

  const fallbackSchema = nestedSchema?.length
    ? nestedSchema
   :Object.keys(fields).map((key) => ({
  id: key,
  type: ["description", "content"].includes(key) ? "RichText" : "Text",
}))

  const normalizedFields: Record<string, any> = {};
  for (const field of fallbackSchema) {
    const key = field.id;
    const value = fields[key];
    console.log(
      `🔧 Normalizing nested field "${key}":`,
      "raw value =", value,
      "| schemaField =", field
    );

    if (value !== undefined) {
      normalizedFields[key] = normalizeValueForContentful(value, field);
    } else {
      console.warn(`⚠️ Skipping "${key}" — no value`);
    }
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
    { contentTypeId: string; entries: any[];  schema?: any[]}
  > = {}
) => {

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
        try {
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

const nestedSchemaFields =
  contentTypeSchemas.find(
    (c) => c.id === nestedContentTypeId || c.uid === nestedContentTypeId
  )?.fields ||
  rootGlobalFieldsArray.find(
    (g) => g.id === nestedContentTypeId || g.uid === nestedContentTypeId
  )?.schema ||
  [];

          if (!incomingNestedSchemas[actual_key]) {
            incomingNestedSchemas[actual_key] = {
              contentTypeId: nestedContentTypeId,
              entries: [],
               schema: nestedSchemaFields // ✅ this makes the nested fields work
            };
         } else if (!incomingNestedSchemas[actual_key].schema) {
  incomingNestedSchemas[actual_key].schema = nestedSchemaFields;
}
incomingNestedSchemas[actual_key].entries = [
  Object.entries(
    value.reduce((acc, item) => {
      // If value is an array of grouped { actual_key, value } fields
      if (item?.actual_key && item.hasOwnProperty("value")) {
        acc[item.actual_key] = item.value;
      }
      return acc;
    }, {})
  ).map(([actual_key, value]) => ({ actual_key, value })),
];
        } catch (err) {
          console.error(`❌ Error processing nested field ${actual_key}:`, err);
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

          nestedFields = Array.isArray(childType?.fields)
            ? childType.fields
            : Array.isArray(childType?.schema)
            ? childType.schema
            : [];
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
    const nestedSchemas: Record<
      string,
      { contentTypeId: string; entries: any[]; schema?: any[] }
    > = {};

    // Step 1: Add only built ones that are missing in incoming
    for (const [key, built] of Object.entries(builtNestedSchemas)) {
      if (!incomingNestedSchemas[key]) {
        nestedSchemas[key] = built;
      }
    }

    // Step 2: Incoming (manual) nested entries always win
    for (const [key, incoming] of Object.entries(incomingNestedSchemas)) {
      nestedSchemas[key] = incoming;
    }

    // Create all nested entries first
    const nestedEntryLinks: Record<string, any[]> = {};
    for (const [fieldKey, schema] of Object.entries(nestedSchemas)) {
      if (!Array.isArray(schema.entries)) continue;

      console.log(`📥 Creating nested entry for: ${schema.contentTypeId}`);
      nestedEntryLinks[fieldKey] = [];
      for (const entryFields of schema.entries) {
        const nestedSchema =
          contentTypeSchemas.find(
            (c) =>
              c.id === schema.contentTypeId || c.uid === schema.contentTypeId
          )?.fields ||
          rootGlobalFieldsArray.find(
            (g) =>
              g.uid === schema.contentTypeId || g.id === schema.contentTypeId
          )?.schema ||
          [];

const plainEntryFields = Array.isArray(entryFields)
  ? Object.fromEntries(entryFields.map(({ actual_key, value }) => [actual_key, value]))
  : entryFields;
console.log("✅ Fields to populate in nested entry:", plainEntryFields);
console.log("✅ Expected schema:", schema.schema);

    console.log("🧩 Final schema fields being passed to createNestedEntry:", schema.schema);
    const nestedEntry = await createNestedEntry(
  schema.contentTypeId,
  plainEntryFields,
  publish,
  schema.schema || []
);
        console.log(`✅ Created nested entry: ${nestedEntry?.sys?.id}`);
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

    function unflattenFields(flatFields: Field[]): Record<string, any> {
      const result: Record<string, any> = {};

      for (const { actual_key, value } of flatFields) {
        if (!actual_key.includes(".")) {
          result[actual_key] = value;
          continue;
        }

        const parts = actual_key.split(".");
        let current = result;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];

          if (i === parts.length - 1) {
            current[part] = value;
          } else {
            current[part] = current[part] || {};
            current = current[part];
          }
        }
      }

      return result;
    }

    payload.fields = {};
    const existingLinkedFields = { ...payload.fields };
    const validFields = fields.filter(
      (f) =>
        f.actual_key &&
        f.value !== undefined &&
        typeof f.actual_key === "string" &&
        !["key", "actual_key", "label", "type"].includes(f.actual_key) &&
        !f.actual_key.includes(".") // 🚫 reject dot notation
    );
    const nestedFields = unflattenFields(validFields);
    for (const [key, value] of Object.entries(nestedFields)) {
      if (payload.fields[key]) continue;
      if (value === undefined || value === null || value === "") continue;

      try {
        const schemaField = contentTypeSchemas.find(
          (f) => f.id === key || f.uid === key
        );

        if (!schemaField) {
          console.warn(`❌ No schema field found for "${key}", skipping.`);
          continue; // 🚨 Prevent calling normalizeValueForContentful with undefined
        }
        let normalized = normalizeValueForContentful(value, schemaField);

        // 🚨 Wrap in array if the schema expects an array
        if (schemaField.type === "Array" && !Array.isArray(normalized)) {
          normalized = [normalized];
        }
        payload.fields[key] = { "en-US": normalized };
      } catch (err: any) {
        console.warn(
          `❌ Error normalizing field "${key}":`,
          err?.message || err
        );
      }
    }

    payload.fields = {
      ...payload.fields,
      ...existingLinkedFields,
    };
 console.log("📥 incomingNestedSchemas:", JSON.stringify(incomingNestedSchemas, null, 2));

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
      const latestEntry = await axios.get(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${createdMainEntry.sys.id}`,
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
          },
        }
      );

      const latestVersion = latestEntry.data.sys.version;

      const publishResponse = await axios.put(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${createdMainEntry.sys.id}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "X-Contentful-Version": latestVersion,
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
