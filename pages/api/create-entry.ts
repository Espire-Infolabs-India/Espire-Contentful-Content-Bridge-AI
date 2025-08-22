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
  uid?: string; // ✅ add this
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
function injectUserSelections(fields: any[], multiSelectValues: Record<string, string[]>) {
  for (const field of fields) {
    // Recurse into arrays
    if (Array.isArray(field.value)) {
      field.value.forEach((item: { [s: string]: unknown; } | ArrayLike<unknown> | null) => {
        if (typeof item === "object" && item !== null) {
          injectUserSelections(
            Object.entries(item).map(([k, v]) => ({ actual_key: k, value: v })),
            multiSelectValues
          );
        }
      });
    }

    // Inject user-selected entries
    const selectedIds = multiSelectValues[field.actual_key];
    if (selectedIds && selectedIds.length > 0) {
      field.value = selectedIds.map(id => ({
        sys: { type: "Link", linkType: "Entry", id }
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

  if ((type === "Text" || type === "Symbol") && typeof value === "object" && "value" in value) {
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


  console.log("▶️ Creating Contentful entry with contentTypeId:", contentTypeId);

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
  incomingNestedSchemas: Record<string, { contentTypeId: string; entries: any[] }> = {},
  multiSelectValues: Record<string, string[]> = {} // ✅ add this
) => {
  console.log("📥 Payload RECEIVED by createContentfulEntry:",
    JSON.stringify(fields, null, 2)
  );
  try {
    const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;
    const payload: { fields: { [key: string]: { "en-US": any } } } = { fields: {} };

    // 👇 Prepare schema references
    let allSchemaObjects: any[] = [...contentTypeSchemas];
    const rootGlobalFields = contentTypeSchemas.filter((f) => f.data_type === "global_field") || [];
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
      const match = field.actual_key.match(/^([a-zA-Z0-9_]+)\[(\d+)\]\[([a-zA-Z0-9_]+)\]$/);
      if (match) {
        const [_, arrayKey, index, subKey] = match;
        if (!acc[arrayKey]) acc[arrayKey] = [];
        if (!acc[arrayKey][+index]) acc[arrayKey][+index] = {};
        acc[arrayKey][+index][subKey] = typeof field.value === "object" && field.value?.value !== undefined
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

    console.log("🧠 All schema field objects (merged):\n", JSON.stringify(allSchemaObjects, null, 2));


    // ✅ ADD THIS BLOCK EARLY TO DETECT FLAT ARRAYS
    for (const field of fields) {
      const { actual_key, value } = field;

      console.log(`🔍 Scanning field: ${actual_key}`);
      if (Array.isArray(value)) {
        console.log(`🔎 Field ${actual_key} is an array with ${value.length} items`);
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
          allSchemaObjects.find((s) => s.id === actual_key || s.uid === actual_key) || {};
        // Try to get the contentTypeId from validations, or fallback by matching id/uid
        const nestedContentTypeId =
          schemaField?.validations?.[0]?.linkContentType?.[0] ||
          schemaField?.linkContentType?.[0] ||
          schemaField?.items?.linkContentType?.[0] || // <== added
          schemaField?.items?.validations?.[0]?.linkContentType?.[0];

        if (!nestedContentTypeId) {
          console.warn(`⚠️ No linked contentTypeId found for "${actual_key}". Falling back to treating as inline object.`);
          // fallback: don’t skip, just push raw entries into incomingNestedSchemas
          if (!incomingNestedSchemas[actual_key]) {
            incomingNestedSchemas[actual_key] = {
              contentTypeId: "__unknown__", // mark unknown, don’t break pipeline
              entries: []
            };
          }
        }

        if (nestedContentTypeId === contentTypeId) {
          console.warn(`⚠️ Nested contentTypeId matches parent for "${actual_key}". This might be intentional (self-reference).`);
        }


        if (!incomingNestedSchemas[actual_key]) {
          incomingNestedSchemas[actual_key] = {
            contentTypeId: nestedContentTypeId, // ✅ use the correct nested type
            entries: [],
          };
        }
        console.log("🧩 incomingNestedSchemas after array/object parse:", JSON.stringify(incomingNestedSchemas, null, 2));


        for (const entry of value) {
          if (typeof entry === "object" && entry !== null) {
            incomingNestedSchemas[actual_key].entries.push(entry);
          }
        }

        console.log(`✅ Detected nested array for ${actual_key} (type: ${contentTypeId})`);
      }
    }

    console.log("🧩 incomingNestedSchemas:", JSON.stringify(incomingNestedSchemas, null, 2));
    // 👇 Build nestedSchemas structure
    const builtNestedSchemas = Object.entries(groupedArrayFields).reduce((acc, [key, entries]) => {
      // 🔍 Try to find matching schema field for this key
      console.log("🔎 Checking allSchemaObjects for key:", key);

      const schemaField = allSchemaObjects.find(
        (s) =>
          s.id === key &&
          (
            (s.type === "Link" && s.linkType === "Entry") ||  // handles single reference
            (s.type === "Array" &&
              s.items?.type === "Link" &&
              s.items?.linkType === "Entry")                 // handles array of references
          )
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
          rootGlobalFieldsArray.find((s) => s?.uid === contentTypeId || s?.id === contentTypeId);

        nestedFields = childType?.fields || childType?.schema || [];
      }

      if (!nestedFields?.length) {
        console.warn(`⚠️ No nested fields found for "${key}" (contentTypeId: "${contentTypeId}")`);
        return acc;
      }


      const structured = entries.map((entryItem: any) => {
        const obj: Record<string, any> = {};
        nestedFields.forEach((nf: any) => {
          const raw = entryItem[nf.id];
          obj[nf.id] = typeof raw === "object" && raw !== null && "value" in raw ? raw.value : raw;
        });
        return obj;
      });

      acc[key] = { entries: structured, contentTypeId };
      return acc;
    }, {} as Record<string, { contentTypeId: string; entries: any[] }>);

    const nestedSchemas = { ...incomingNestedSchemas, ...builtNestedSchemas };

    // ✅ STEP 1: Create all nested entries first
    const nestedEntryLinks: Record<string, any[]> = {};



    for (const [fieldKey, schema] of Object.entries(nestedSchemas)) {
      if (!Array.isArray(schema.entries)) continue;
      if (!nestedEntryLinks[fieldKey]) nestedEntryLinks[fieldKey] = [];

      for (const entryFields of schema.entries) {
        // ✅ Step 3A: Inject user selections for Link-type fields
        const selectedIds = multiSelectValues[fieldKey]; // array of selected entry IDs
        if (selectedIds && selectedIds.length > 0) {
          for (const [nestedFieldKey, nestedFieldValue] of Object.entries(entryFields)) {
            const schemaField = contentTypeSchemas
              .flatMap(s => s.fields)
              .find(f => f.id === nestedFieldKey || (f as any).uid === nestedFieldKey);

            if (!schemaField) continue;
            // ✅ NEW: Proper handling based on field type
            if (schemaField.type === "Link") {
              // Single reference
              entryFields[nestedFieldKey] = {
                sys: { type: "Link", linkType: "Entry", id: nestedFieldValue }
              };
            } else if (schemaField.type === "Array" && schemaField.items?.type === "Link") {
              // Array of references
              const ids = Array.isArray(nestedFieldValue) ? nestedFieldValue : [nestedFieldValue];
              entryFields[nestedFieldKey] = ids.map(id => ({
                sys: { type: "Link", linkType: "Entry", id }
              }));
            }
          }
        }

        const nestedEntry = await createNestedEntry(schema.contentTypeId, entryFields, publish);
        // ✅ LOG THIS
        console.log(`✅ Created nested entry for ${fieldKey}: [Link id: ${nestedEntry.sys?.id}]`);
        nestedEntryLinks[fieldKey].push({
          sys: {
            type: "Link",
            linkType: "Entry",
            id: nestedEntry.sys?.id,
          },
        });
      }
    }
    // ✅ ADD LOGS HERE
    console.log("📌 User-selected nested links:", multiSelectValues);
    console.log("📌 Nested entry links prepared:", nestedEntryLinks);
    for (const [fieldKey, links] of Object.entries(nestedEntryLinks)) {
      const field = fields.find((f) => f.actual_key === fieldKey);
      if (field) {
        // Initialize as array if undefined
        if (!Array.isArray(field.value)) field.value = [];

        // Merge links into the existing array
        field.value = field.value.concat(links);
      }
    }

    console.log("📌 Final links in componentContainer:", JSON.stringify(
      fields.find(f => f.actual_key === "componentContainer")?.value, null, 2
    ));



    // ✅ STEP 3: Sanity check debug log
    console.log("🚧 Final fieldsToSend before entry creation:", JSON.stringify(fields, null, 2));

    fields.forEach((field) => {
      const key = field.actual_key;
      if (/\[[0-9]+\]\[.+\]/.test(key)) return; // Skip flattened subfields
      if (field.value === undefined || field.value === null || field.value === "") return;

      // Get schema for this field
      const schemaField = allSchemaObjects.find(
        (s) => s.id === key || s.uid === key
      );

      // Normalize according to schema
      const normalizedValue = normalizeValueForContentful(field.value, schemaField);

      payload.fields[key] = { "en-US": normalizedValue };
    });

    // Merge duplicate field keys into arrays
    const mergedFieldsMap: Record<string, any> = {};

    for (const field of fields) {
      if (field.actual_key === "componentContainer") {
        if (!mergedFieldsMap[field.actual_key]) {
          mergedFieldsMap[field.actual_key] = [];
        }

        // ✅ Flatten if field.value is already an array of links
        if (Array.isArray(field.value)) {
          mergedFieldsMap[field.actual_key].push(...field.value);
        } else {
          mergedFieldsMap[field.actual_key].push(field.value);
        }

      } else {
        mergedFieldsMap[field.actual_key] = field.value;
      }
    }


    // Convert back to your fields array format
    const finalFields = Object.entries(mergedFieldsMap).map(([key, value]) => ({
      key,
      actual_key: key,
      value
    }));

    console.log("🚀 Sending final merged fields:", JSON.stringify(finalFields, null, 2));

    // ✅ Rich Text fields in Contentful that need special formatting
    const richTextFields = ["description", "content"];

    // ✅ Build payload from finalFields
    const finalPayload = {
      fields: finalFields.reduce((acc, field) => {
        let value = field.value;

        // ✅ normalize numbers
        if (!isNaN(value) && value !== "" && value !== null && value !== undefined) {
          // only if the value looks like a number (e.g. "0.8", "10")
          value = Number(value);
        }

        // ✅ normalize booleans
        if (value === "true" || value === true) {
          value = true;
        } else if (value === "false" || value === false) {
          value = false;
        }

        // ✅ normalize rich text
        if (richTextFields.includes(field.actual_key) && typeof field.value === "string") {
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
                    value: field.value,
                    marks: [],
                    data: {}
                  }
                ]
              }
            ]
          };
        }

        acc[field.actual_key] = { "en-US": value };
        return acc;
      }, {} as Record<string, any>)
    };


    // Hardcoded fields that should always be array of links
    const arrayLinkFields = [
      "author",
      "cardList",
      "listOfSocialMedia",
      "slides",
      "accordionItemsList",
      "tabs",
    ];

    for (const [key, wrapped] of Object.entries(finalPayload.fields)) {
      console.log(`🔍 Processing field: "${key}"`);
      console.log("   Value before normalization:", JSON.stringify(wrapped["en-US"], null, 2));

      // ✅ Hardcoded array of links handling
      if (arrayLinkFields.includes(key)) {
        if (!Array.isArray(wrapped["en-US"])) {
          console.log(`🔧 Hardcoded normalization: converting "${key}" to array`);
          wrapped["en-US"] = [wrapped["en-US"]];
        }
        wrapped["en-US"] = wrapped["en-US"].map((id: any) => {
          if (typeof id === "string") {
            console.log(`🔗 Wrapping Link ID "${id}" for hardcoded array field "${key}"`);
            return { sys: { type: "Link", linkType: "Entry", id } };
          }
          return id; // already a Link object
        });

        console.log("   Value after hardcoded normalization:", JSON.stringify(wrapped["en-US"], null, 2));
        continue; // skip schema-based normalization for these fields
      }

      // Schema-based normalization
      const schemaField = allSchemaObjects.find(s => s.id === key || s.uid === key);
      if (!schemaField) {
        console.log(`⚠️ No schema info for field "${key}", skipping Link normalization`);
        continue;
      }

      // Normalize arrays for Array type fields
      if (schemaField.type === "Array" && !Array.isArray(wrapped["en-US"])) {
        console.log(`🔧 Normalizing field "${key}" to array`);
        wrapped["en-US"] = [wrapped["en-US"]];
      }

      // Single Link field
      if (schemaField.type === "Link") {
        if (typeof wrapped["en-US"] === "string") {
          console.log(`🔗 Wrapping single Link ID for "${key}"`);
          wrapped["en-US"] = { sys: { type: "Link", linkType: "Entry", id: wrapped["en-US"] } };
        }
      }
      // Array of Links
      else if (schemaField.type === "Array" && schemaField.items?.type === "Link") {
        wrapped["en-US"] = wrapped["en-US"].map((id: any) => {
          if (typeof id === "string") {
            console.log(`🔗 Wrapping Link ID "${id}" for array field "${key}"`);
            return { sys: { type: "Link", linkType: "Entry", id } };
          }
          return id;
        });
      }
      console.log("   Value after schema normalization:", JSON.stringify(wrapped["en-US"], null, 2));
    }



    // ✅ STEP 4: Create main entry
    console.log("✅ FINAL contentTypeId:", contentTypeId);
    console.log("✅ FINAL URL:", url);
    console.log("🧪 FINAL Payload before sending to Contentful:\n", JSON.stringify(payload, null, 2));
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
    console.error("❌ Error creating entry:", error?.response?.data || error?.message || error);
    throw error;
  }
};
