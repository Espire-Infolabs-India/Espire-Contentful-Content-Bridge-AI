import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "contentful-management";

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID!;
const ENVIRONMENT_ID = process.env.CONTENTFUL_ENVIRONMENT_ID || "master";
const CONTENTFUL_MANAGEMENT_TOKEN = process.env.CONTENTFUL_MANAGEMENT_TOKEN!;

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const client = createClient({
      accessToken: CONTENTFUL_MANAGEMENT_TOKEN,
    });

    const space = await client.getSpace(SPACE_ID);
    const environment = await space.getEnvironment(ENVIRONMENT_ID);

    const assets = await environment.getAssets({ limit: 100 });

    const formattedAssets = assets.items.map((asset) => ({
      id: asset.sys.id,
      title: asset.fields.title?.["en-US"] || "Untitled",
      url: asset.fields.file?.["en-US"]?.url
        ? "https:" + asset.fields.file["en-US"].url
        : "",
    }));

    res.status(200).json(formattedAssets);
  } catch (error: any) {
    console.error("❌ Error fetching assets from Contentful:", error);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
};

export default handler;
