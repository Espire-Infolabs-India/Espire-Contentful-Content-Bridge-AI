import axios from "axios";

export default async function handler(req, res) {
  try {
    const spaceId = process.env.CONTENTFUL_SPACE_ID;
    const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;
    const environmentId = process.env.CONTENTFUL_ENVIRONMENT || "dev";

    const response = await axios.get(
      `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types`,
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
      }
    );

      const contentTypes = response.data.items.map((item) => ({
      uid: item.sys.id,
      title: item.name,
      options: { is_page: true },
    }))


    res.status(200).json({ content_types: contentTypes });
  } catch (error) {
    console.error(
      "Error fetching Content Types:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || null,
    });
  }
}
