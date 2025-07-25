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
  console.log(` Fetching content type schema for: ${contentTypeId}`);
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

    const simplifiedSchema = [];

    for (const field of rootFields) {
      const simplifiedField: any = {
        id: field.id,
        name: field.name,
        display_name: field.name,
        type: field.type,
      };

      if (field.type === "Array" && field.items?.linkType === "Entry") {
        const refTypes = field.items?.validations?.find((v: any) => v.linkContentType)?.linkContentType;

        if (refTypes && refTypes.length > 0) {
          const nestedType = refTypes[0];
          simplifiedField.linkContentType = nestedType;

          const nested = nestedSchemas[nestedType] || [];
          simplifiedField.nestedFields = nested.map((nf: any) => ({
            id: nf.id,
            name: nf.name,
            display_name: nf.name,
            type: nf.type,
          }));

        }
      }
      simplifiedSchema.push(simplifiedField);
    }

    return res.status(200).json({ schema: simplifiedSchema });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(" Error fetching content type schema (Axios):", error.response?.data || error.message);
    } else {
      console.error(" Error fetching content type schema:", error.message || error);
    }

    return res.status(500).json({
      error: "Failed to fetch content type schema",
    });
  }
}
