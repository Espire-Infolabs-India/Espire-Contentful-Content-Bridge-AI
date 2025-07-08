import axios from "axios";

export default async function handler(req, res) {
  const contentType = req?.query?.content_type;

  if (!contentType) {
    return res.status(400).json({ error: "Missing 'content_type' parameter" });
  }

  const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
  const accessToken = process.env.NEXT_PUBLIC_CONTENTFUL_DELIVERY_TOKEN;
  const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";

  if (!spaceId || !accessToken) {
    return res.status(500).json({ error: "Missing Contentful credentials" });
  }

  try {
    const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        content_type: contentType,
      },
    });

    console.log(`Fetched ${response?.data?.items?.length || 0} entries for ${contentType}`);

    return res.status(200).json({ entries: response.data.items });
  } catch (error) {
    console.error("Error fetching Contentful entries:", error?.response?.data || error.message);
    return res.status(500).json({
      error: error?.response?.data?.message || "Failed to fetch Contentful entries",
    });
  }
}
