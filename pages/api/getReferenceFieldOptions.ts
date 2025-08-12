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
    // Use the same token you already have in .env
    const deliveryToken =
      process.env.CONTENTFUL_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN!;

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

    const options = response.data.items.map((item: any) => {
      // Use first locale found in item.fields or default to "en-US"
      const locale = Object.keys(item.fields)[0] || "en-US";
      return {
        value: item.sys.id,
        label:
          item.fields.title?.[locale] ||
          item.fields.name?.[locale] ||
          `Untitled (${item.sys.id})`,
      };
    });

    return res.status(200).json({ options });
  } catch (error: any) {
    console.error(
      "❌ Error fetching reference options:",
      error.response?.data || error.message
    );
    return res.status(500).json({ error: "Failed to fetch reference field options" });
  }
}