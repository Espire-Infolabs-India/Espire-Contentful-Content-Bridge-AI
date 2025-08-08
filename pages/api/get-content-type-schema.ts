import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// Recursive helper to fetch nested schemas
async function fetchFieldsFromContentType(
  contentTypeId: string,
  spaceId: string,
  environmentId: string,
  managementToken: string,
  nestedSchemas: Record<string, any>,
  visited = new Set<string>()
): Promise<any[]> {
  if (visited.has(contentTypeId)) return [];
  visited.add(contentTypeId);

  const res = await axios.get(
    `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}`,
    {
      headers: {
        Authorization: `Bearer ${managementToken}`,
      },
    }
  );

  const fields = res.data.fields || [];
  nestedSchemas[contentTypeId] = fields;

  for (const field of fields) {
    // Single Link
    if (field.type === "Link" && field.linkType === "Entry") {
      const refTypes = field.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      if (refTypes) {
        for (const nestedType of refTypes) {
          await fetchFieldsFromContentType(nestedType, spaceId, environmentId, managementToken, nestedSchemas, visited);
        }
      }
    }

    // Array of Links
    if (field.type === "Array" && field.items?.linkType === "Entry") {
      const refTypes = field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;
      if (refTypes) {
        for (const nestedType of refTypes) {
          await fetchFieldsFromContentType(nestedType, spaceId, environmentId, managementToken, nestedSchemas, visited);
        }
      }
    }
  }

  return fields;
}

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
    const rootFields = await fetchFieldsFromContentType(template, spaceId, environmentId, managementToken, nestedSchemas, new Set());

    // 🔍 Fetch help text from editor interface
    const editorRes = await axios.get(
      `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${template}/editor_interface`,
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
        },
      }
    );

    console.log("🧪 Editor Interface Response:");
console.log(JSON.stringify(editorRes.data, null, 2));
    const helpTextMap: Record<string, string> = {};
    for (const control of editorRes.data.controls || []) {
      if (control.fieldId && control.settings?.helpText) {
        helpTextMap[control.fieldId] = control.settings.helpText;
      }
    }

    const simplifiedSchema = [];

    for (const field of rootFields) {
      console.log("🌐 Raw Field:", JSON.stringify(field, null, 2));

      const simplifiedField: any = {
        id: field.id,
        name: field.name,
        display_name: field.name,
      helpText: helpTextMap[field.id] || "", // ✅ ensures field is present✅ fetched from editor_interface
        type: field.type,
      };

      if (field.type === "Array" && field.items?.linkType === "Entry") {
        const refTypes = field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;

        if (refTypes && refTypes.length > 0) {
          const nestedType = refTypes[0];
          simplifiedField.linkContentType = nestedType;

          const nested = nestedSchemas[nestedType] || [];

          // 👇 Fetch nested helpTextMap too
          const nestedEditorRes = await axios.get(
            `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${nestedType}/editor_interface`,
            {
              headers: {
                Authorization: `Bearer ${managementToken}`,
              },
            }
          );

          const nestedHelpTextMap: Record<string, string> = {};
          for (const control of nestedEditorRes.data.controls || []) {
            if (control.fieldId && control.settings?.helpText) {
              nestedHelpTextMap[control.fieldId] = control.settings.helpText;
            }
          }

          simplifiedField.nestedFields = nested.map((nf: any) => ({
            id: nf.id,
            name: nf.name,
            display_name: nf.name,
            helpText: nestedHelpTextMap[nf.id] || "",
            type: nf.type,
          }));
        }
      }

      simplifiedSchema.push(simplifiedField);
      console.log("📦 Final simplifiedField:", simplifiedField);
    }

    return res.status(200).json({ schema: simplifiedSchema });
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
