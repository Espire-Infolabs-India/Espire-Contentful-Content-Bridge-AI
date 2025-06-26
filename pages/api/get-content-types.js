import axios from 'axios';

export default async function handler(req, res) {
    try {
        const spaceId = process.env.CONTENTFUL_SPACE_ID;
        const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

        const response = await axios.get(
            `https://api.contentful.com/spaces/${spaceId}/content_types`,
            {
                headers: {
                    Authorization: `Bearer ${managementToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.status(200).json(response.data);

    } catch (error) {
        console.error('Error fetching Content Types:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data || null,
        });
    }
}
