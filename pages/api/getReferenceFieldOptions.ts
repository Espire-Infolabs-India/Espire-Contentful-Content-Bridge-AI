// pages/api/getReferenceFieldOptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contentType, limit = 1000 } = req.query;

  if (!contentType || typeof contentType !== "string") {
    return res.status(400).json({ error: "Missing or invalid contentType parameter" });
  }

  try {
    const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID!;
    const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
    const deliveryToken =
      process.env.CONTENTFUL_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN!;
    const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN!;

    // 1️⃣ Get content type definition
    const ctRes = await axios.get(
      `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentType}`,
      { headers: { Authorization: `Bearer ${managementToken}` } }
    );

    const contentTypeDef = ctRes.data;
    const displayField: string | undefined = contentTypeDef.displayField;

    // 2️⃣ Get entries
    const entriesRes = await axios.get(
      `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`,
      {
        headers: { Authorization: `Bearer ${deliveryToken}` },
        params: { content_type: contentType, limit },
      }
    );

    const items = entriesRes.data.items;

    const options = items.map((item: any) => {
      let label = "";

      // ✅ If displayField exists, use it
      if (displayField && item.fields[displayField]) {
        const fieldValue = item.fields[displayField];
        if (typeof fieldValue === "string") {
          label = fieldValue;
        } else if (typeof fieldValue === "object") {
          const locale = Object.keys(fieldValue)[0];
          label = fieldValue[locale];
        }
      }

      // ✅ If still empty, prioritize `name` field if present
      if (!label && item.fields.name) {
        if (typeof item.fields.name === "string") {
          label = item.fields.name;
        } else {
          const locale = Object.keys(item.fields.name)[0];
          label = item.fields.name[locale];
        }
      }

      // ✅ If still empty, use first non-empty string field
      if (!label) {
        for (const fieldId in item.fields) {
          const value = item.fields[fieldId];
          if (typeof value === "string" && value.trim()) {
            label = value;
            break;
          } else if (typeof value === "object") {
            const locale = Object.keys(value)[0];
            if (typeof value[locale] === "string" && value[locale].trim()) {
              label = value[locale];
              break;
            }
          }
        }
      }

      // ✅ Fallback
      if (!label) {
        label = `Untitled (${item.sys.id})`;
      }

      return { value: item.sys.id, label };
    });


    return res.status(200).json({ options });
  } catch (error: any) {
    console.error("❌ Error fetching reference options:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to fetch reference field options" });
  }
}
