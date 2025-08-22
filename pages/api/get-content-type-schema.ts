import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// --- Helper: Recursively fetch content type schema ---
async function fetchFieldsFromContentType(
  contentTypeId: string,
  spaceId: string,
  environmentId: string,
  managementToken: string,
  nestedSchemas: Record<string, any>,
  visited = new Set<string>(),
  depth = 1
): Promise<any[]> {
  if (visited.has(contentTypeId)) return [];
  visited.add(contentTypeId);

  const res = await axios.get(
    `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}`,
    {
      headers: { Authorization: `Bearer ${managementToken}` },
    }
  );

  const fields = res.data.fields || [];
  nestedSchemas[contentTypeId] = fields;

  for (const field of fields) {
    field._depth = depth; // ✅ Track depth at the field level
    let refTypes: string[] | undefined;

    if (field.type === "Link" && field.linkType === "Entry") {
      refTypes = field.validations?.find((v: any) => v.linkContentType)?.linkContentType;
    }

    if (field.type === "Array" && field.items?.linkType === "Entry") {
      refTypes = field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;
    }

    if (refTypes) {
      for (const nestedType of refTypes) {
        await fetchFieldsFromContentType(
          nestedType,
          spaceId,
          environmentId,
          managementToken,
          nestedSchemas,
          visited,
          depth + 1
        );
      }
    }
  }

  return fields;
}

// --- Helper: Fetch helpText mapping ---
async function fetchHelpTextMap(
  contentTypeId: string,
  spaceId: string,
  environmentId: string,
  managementToken: string
) {
  const editorRes = await axios.get(
    `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}/editor_interface`,
    {
      headers: { Authorization: `Bearer ${managementToken}` },
    }
  );

  const map: Record<string, string> = {};
  for (const control of editorRes.data.controls || []) {
    if (control.fieldId && control.settings?.helpText) {
      map[control.fieldId] = control.settings.helpText;
    }
  }
  return map;
}

// --- Helper: Attach nested fields recursively ---
async function addNestedFields(
  parentField: any,
  refTypes: string[],
  nestedSchemas: Record<string, any>,
  spaceId: string,
  environmentId: string,
  managementToken: string,
) {
  parentField.linkContentType = refTypes;
  parentField.nestedFields = [];

  for (const nestedType of refTypes) {
    const nestedFields = nestedSchemas[nestedType] || [];
    const nestedHelpTextMap = await fetchHelpTextMap(nestedType, spaceId, environmentId, managementToken);

    for (const nf of nestedFields) {
      const depth = (parentField._depth || 1) + 1;
      const nestedField: any = {
        id: nf.id,
        name: nf.name,
        display_name: nf.name,
        helpText: nestedHelpTextMap[nf.id] || "",
        type: nf.type,
        from: nestedType,
        _depth: depth,
        isTripleNested: depth === 3,
      };


      // ✅ If triple nested, store the content type ID for later fetching by getReferenceFieldOptions
// ✅ Always store content type IDs for dropdowns
nestedField.dropdownContentTypes =
  nf.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType ||
  nf.validations?.find((v: any) => v.linkContentType)?.linkContentType ||
  [];

        // ✅ Stop recursion beyond depth 3
      if (depth >= 3) {
        parentField.nestedFields.push(nestedField);
        continue;
      }
      // If still a reference, go deeper
      let childRefTypes: string[] | undefined;
      if (nf.type === "Link" && nf.linkType === "Entry") {
        childRefTypes = nf.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      }
      if (nf.type === "Array" && nf.items?.linkType === "Entry") {
        childRefTypes = nf.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      }
      if (childRefTypes && childRefTypes.length > 0) {
        await addNestedFields(
          nestedField,
          childRefTypes,
          nestedSchemas,
          spaceId,
          environmentId,
          managementToken,
        );
      }

      parentField.nestedFields.push(nestedField);
    }
  }
}

// --- API Handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { template } = req.query;

  if (!template || typeof template !== "string") {
    return res.status(400).json({ error: "Missing content type ID (`template`)" });
  }

  try {
    const spaceId = process.env.CONTENTFUL_SPACE_ID!;
    const environmentId = process.env.CONTENTFUL_ENVIRONMENT || "dev";
    const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN!;

    const nestedSchemas: Record<string, any> = {};
    const rootFields = await fetchFieldsFromContentType(
      template,
      spaceId,
      environmentId,
      managementToken,
      nestedSchemas
    );
    const helpTextMap = await fetchHelpTextMap(template, spaceId, environmentId, managementToken);

    const simplifiedSchema: any[] = [];
    

    for (const field of rootFields) {
      const simplifiedField: any = {
        id: field.id,
        name: field.name,
        display_name: field.name,
        helpText: helpTextMap[field.id] || "",
        type: field.type,
        _depth: field._depth || 1,
        isTripleNested: (field._depth || 1) >= 3,
      };

      let refTypes: string[] | undefined;
      if (field.type === "Link" && field.linkType === "Entry") {
        refTypes = field.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      }
      if (field.type === "Array" && field.items?.linkType === "Entry") {
        refTypes = field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      }

      // ✅ Add dropdown content types for frontend fetching
simplifiedField.dropdownContentTypes =
  field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType ||
  field.validations?.find((v: any) => v.linkContentType)?.linkContentType ||
  [];

      if (refTypes && refTypes.length > 0) {
        await addNestedFields(
          simplifiedField,
          refTypes,
          nestedSchemas,
          spaceId,
          environmentId,
          managementToken,
        );
      }

      simplifiedSchema.push(simplifiedField);
    }

    return res.status(200).json({
      schema: simplifiedSchema,
    });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Axios error:", error.response?.data || error.message);
    } else {
      console.error("❌ Error:", error.message || error);
    }

    return res.status(500).json({
      error: "Failed to fetch content type schema",
    });
  }
}
