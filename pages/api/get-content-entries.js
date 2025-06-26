import axios from "axios";

export default async function handler(req, res) {
  const contentName = req?.query?.content_name;

  if (!contentName) {
    return res.status(400).json({ error: "Missing 'content_name' parameter" });
  }

  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;
  const environmentId = process.env.CONTENTFUL_ENVIRONMENT || "dev";

  if (!spaceId || !accessToken) {
    return res.status(500).json({ error: "Missing Contentful credentials" });
  }

  try {
    console.log(`Fetching entries for Content Type: ${contentName}`);

    const url = `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        content_type: contentName,
      },
    });

    console.log(`Fetched ${response?.data?.items?.length || 0} entries for ${contentName}`);

    return res.status(200).json({ entries: response.data.items });
  } catch (error) {
    console.error("Error fetching Contentful entries:", error?.response?.data || error.message);
    return res.status(500).json({
      error: error?.response?.data?.message || "Failed to fetch Contentful entries",
    });
  }
}
