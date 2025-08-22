// pages/api/getReferenceFieldOptions.ts
import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
const deliveryToken = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { contentType, limit = 1000 } = req.query;

  if (!contentType || typeof contentType !== "string") {
    return res.status(400).json({ error: "Missing or invalid contentType parameter" });
  }

  try {
    const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${deliveryToken}`,
      },
      params: {
        content_type: contentType,
        limit,
      },
    });

    const items = response.data.items;
    const includes = response.data.includes?.Entry || [];

    // 1️⃣ Build lookup for included entries
    const lookup: Record<string, string> = {};
    includes.forEach((inc: any) => {
      const locale = Object.keys(inc.fields.name || inc.fields.title || {})[0];
      const label =
        inc.fields.name?.[locale] ||
        inc.fields.title?.[locale] ||
        `Untitled (${inc.sys.id})`;
      lookup[inc.sys.id] = label;
    });

    // 2️⃣ Map main entries to dropdown options
    const options = items.map((item: any) => {
      let label: string | undefined;

      // Direct text field
      const locale =
        Object.keys(item.fields.name || item.fields.title || {})[0] || "en-US";
      label =
        item.fields.name?.[locale] ||
        item.fields.title?.[locale] ||
        undefined;

      // If not found, check if it's a reference
      if (!label) {
        for (const fieldKey in item.fields) {
          const fieldValue = item.fields[fieldKey];
          if (Array.isArray(fieldValue)) {
            const ref = fieldValue[0];
            if (ref?.sys?.id && lookup[ref.sys.id]) {
              label = lookup[ref.sys.id];
              break;
            }
          } else if (fieldValue?.sys?.id && lookup[fieldValue.sys.id]) {
            label = lookup[fieldValue.sys.id];
            break;
          }
        }
      }

      return {
        value: item.sys.id,
        label: label || `Untitled (${item.sys.id})`,
      };
    });

    res.status(200).json({ options });
  } catch (error: any) {
    console.error("❌ Error fetching reference options:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch reference field options" });
  }
}
