import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";

const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
const deliveryToken = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries?content_type=author`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${deliveryToken}`,
      },
    });

    // Log the raw response from Contentful to inspect structure
    console.log("Raw Author Entries from Contentful:\n", JSON.stringify(response.data.items, null, 2));

    const authors = response.data.items.map((item: any) => {
      const localeKey = item.fields.name ? Object.keys(item.fields.name)[0] : null;
      return {
        id: item.sys.id,
        name: localeKey ? item.fields.name[localeKey] : "Unnamed Author",
      };
    });

    res.status(200).json(authors);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error("Error fetching authors:", error.response?.data || error.message);
    } else if (error instanceof Error) {
      console.error("Error fetching authors:", error.message);
    } else {
      console.error("Error fetching authors:", String(error));
    }
    res.status(500).json({ error: "Failed to fetch authors" });
  }
}
