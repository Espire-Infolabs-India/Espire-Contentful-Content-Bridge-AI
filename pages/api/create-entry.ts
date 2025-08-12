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

  if (type === "Array") {
    // Ensure it's always an array
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

  console.log(
    "▶️ Creating Contentful entry with contentTypeId:",
    contentTypeId
  );

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
    "▶️ Creating Contentful entry with contentTypeId:",
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

    // 👇 Build grouped array fields like productBanner[0][title]
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
    console.log("🧮 Grouped (flattened) array fields:", groupedArrayFields);

    // 🧼 Remove flattened subfield keys
    for (const key of Object.keys(groupedArrayFields)) {
      for (let i = fields.length - 1; i >= 0; i--) {
        if (fields[i].actual_key.startsWith(`${key}[`)) {
          fields.splice(i, 1);
        }
      }
    }

    // 🧩 Add grouped entries back as flat object-style values
    for (const [key, entries] of Object.entries(groupedArrayFields)) {
      fields.push({ actual_key: key, value: entries });
    }

    // 🧩 Also handle object-style nested arrays like productPageSeo: [{ title: ..., description: ... }]
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
        console.log(`🧩 Direct nested array added for "${actual_key}"`);
      }
    });

    console.log(
      "🧠 All schema field objects (merged):\n",
      JSON.stringify(allSchemaObjects, null, 2)
    );

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
        // Try to get the contentTypeId from validations, or fallback by matching id/uid
        const nestedContentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0] ||
          schemaField?.linkContentType?.[0] ||
          schemaField?.items?.linkContentType?.[0] || // <== added
          schemaField?.items?.validations?.[0]?.linkContentType?.[0];

        if (!nestedContentTypeId || nestedContentTypeId === contentTypeId) {
          console.error(
            `🚨 Skipping nested entry. Invalid or duplicate contentTypeId for "${actual_key}" — Got: "${nestedContentTypeId}"`
          );
          continue; // Skip instead of using wrong content type
        }

        if (!incomingNestedSchemas[actual_key]) {
          incomingNestedSchemas[actual_key] = {
            contentTypeId: nestedContentTypeId, // ✅ use the correct nested type
            entries: [],
          };
        }
        console.log(
          "🧩 incomingNestedSchemas after array/object parse:",
          JSON.stringify(incomingNestedSchemas, null, 2)
        );

        for (const entry of value) {
          if (typeof entry === "object" && entry !== null) {
            incomingNestedSchemas[actual_key].entries.push(entry);
          }
        }

        console.log(
          `✅ Detected nested array for ${actual_key} (type: ${contentTypeId})`
        );
      }
    }

    console.log(
      "🧩 incomingNestedSchemas:",
      JSON.stringify(incomingNestedSchemas, null, 2)
    );
    // 👇 Build nestedSchemas structure
    const builtNestedSchemas = Object.entries(groupedArrayFields).reduce(
      (acc, [key, entries]) => {
        // 🔍 Try to find matching schema field for this key
        console.log("🔎 Checking allSchemaObjects for key:", key);

        const schemaField = allSchemaObjects.find(
          (s) =>
            s.id === key &&
            ((s.type === "Link" && s.linkType === "Entry") || // handles single reference
              (s.type === "Array" &&
                s.items?.type === "Link" &&
                s.items?.linkType === "Entry")) // handles array of references
        );

        if (!schemaField) {
          console.warn(`⚠️ Schema field not found for key: "${key}"`);
          return acc;
        }

        // 🧠 Extract contentTypeId from validations
        const contentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0] ||
          schemaField?.items?.validations?.[0]?.linkContentType?.[0];

        console.log("🔍 building nested for:", key, "=>", contentTypeId);

        if (!contentTypeId) {
          console.warn(`⚠️ No linked content type found for "${key}"`);
          return acc;
        }

        // 📦 Attempt to resolve nestedFields
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
            `⚠️ No nested fields found for "${key}" (contentTypeId: "${contentTypeId}")`
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

    // ✅ STEP 1: Create all nested entries first
    const nestedEntryLinks: Record<string, any[]> = {};

    for (const [fieldKey, schema] of Object.entries(nestedSchemas)) {
      if (!Array.isArray(schema.entries)) continue;
      if (!nestedEntryLinks[fieldKey]) nestedEntryLinks[fieldKey] = [];
      for (const entryFields of schema.entries) {
        console.log(
          `🧱 Creating nested entry of type "${schema.contentTypeId}" for field "${fieldKey}"`
        );

        const nestedEntry = await createNestedEntry(
          schema.contentTypeId,
          entryFields,
          publish
        );
        // ✅ LOG THIS
        console.log(
          `✅ Created nested entry for ${fieldKey}: [Link id: ${nestedEntry.sys?.id}]`
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
        console.log(
          `✅ Replacing raw nested field '${fieldKey}' with linked entries`
        );
        field.value = links;
      }
    }

    // ✅ STEP 3: Sanity check debug log
    console.log(
      "🚧 Final fieldsToSend before entry creation:",
      JSON.stringify(fields, null, 2)
    );

    fields.forEach((field) => {
      const key = field.actual_key;
      if (/\[[0-9]+\]\[.+\]/.test(key)) return; // Skip flattened subfields
      if (
        field.value === undefined ||
        field.value === null ||
        field.value === ""
      )
        return;

      // Get schema for this field
      const schemaField = allSchemaObjects.find(
        (s) => s.id === key || s.uid === key
      );

      // Normalize according to schema
      const normalizedValue = normalizeValueForContentful(
        field.value,
        schemaField
      );

      payload.fields[key] = { "en-US": normalizedValue };
    });

    // Merge duplicate field keys into arrays
    const mergedFieldsMap: Record<string, any> = {};

    for (const field of fields) {
      if (field.actual_key === "componentBlock") {
        if (!mergedFieldsMap[field.actual_key]) {
          mergedFieldsMap[field.actual_key] = [];
        }
        mergedFieldsMap[field.actual_key].push(field.value);
      } else {
        mergedFieldsMap[field.actual_key] = field.value;
      }
    }

    // Convert back to your fields array format
    const finalFields = Object.entries(mergedFieldsMap).map(([key, value]) => ({
      key,
      actual_key: key,
      value,
    }));

    console.log(
      "🚀 Sending final merged fields:",
      JSON.stringify(finalFields, null, 2)
    );

    // ✅ Rich Text fields in Contentful that need special formatting
    const richTextFields = ["description", "content"];

    // ✅ Build payload from finalFields
    const finalPayload = {
      fields: finalFields.reduce((acc, field) => {
        let value = field.value;

        // If this is a Rich Text field and the value is a string → wrap in Rich Text JSON
        if (
          richTextFields.includes(field.actual_key) &&
          typeof value === "string"
        ) {
          value = {
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
        }

        acc[field.actual_key] = { "en-US": value };
        return acc;
      }, {} as Record<string, any>),
    };

    // ✅ STEP 4: Create main entry
    console.log("✅ FINAL contentTypeId:", contentTypeId);
    console.log("✅ FINAL URL:", url);
    console.log(
      "🧪 FINAL Payload before sending to Contentful:\n",
      JSON.stringify(payload, null, 2)
    );
    console.log("📎 Headers:", {
      Authorization: `Bearer ${managementToken?.slice(0, 8)}...`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
      "X-Contentful-Content-Type": contentTypeId,
    });

    // ✅ STEP 4: Create main entry
    const response = await axios.post(url, finalPayload, {
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
