import axios from "axios";

const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
const managementToken = process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN;

interface Field {
  key: string;
  actual_key: string;
  value: any;
}

export const createContentfulEntry = async (
  fields: Field[],
  contentTypeId: string,
  publish: boolean = false
) => {
  try {
    const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`;

    const payload: {
      fields: {
        [key: string]: { "en-US": any };
      };
    } = {
      fields: {},
    };

    fields.forEach((field) => {
      if (field.value === undefined || field.value === null || field.value === "") return;

      // 1️⃣ Author Reference
      if (field.actual_key === "author" && field.value?.sys?.id) {
        payload.fields[field.actual_key] = {
          "en-US": {
            sys: {
              type: "Link",
              linkType: "Entry",
              id: field.value.sys.id,
            },
          },
        };
        return;
      }

      // 2️⃣ Rich Text Fields (content, description)
      if (field.actual_key === "content" || field.actual_key === "description") {
        payload.fields[field.actual_key] = { "en-US": field.value };
        return;
      }

      // 3️⃣ Generic Reference (image, other links)
      if (typeof field.value === "object" && field.value?.sys?.id) {
        const linkType =
          field.actual_key === "image" ? "Asset" : field.value.sys.linkType || "Entry";

        payload.fields[field.actual_key] = {
          "en-US": {
            sys: {
              type: "Link",
              linkType,
              id: field.value.sys.id,
            },
          },
        };
        return;
      }

      // 4️⃣ Simple Fields
      payload.fields[field.actual_key] = {
        "en-US": field.value,
      };
    });

    console.log("✅ Payload to Contentful:", JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": contentTypeId,
      },
    });

    console.log("✅ Entry created successfully:", response.data);

    // Optional publish
    if (publish) {
      const entryId = response.data?.sys?.id;
      const version = response.data?.sys?.version;

      if (!entryId || !version) {
        throw new Error("Missing entry ID or version for publishing.");
      }

      const publishResponse = await axios.put(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}/published`,
        {},
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "X-Contentful-Version": version,
          },
        }
      );

      console.log("✅ Entry published successfully:", publishResponse.data);
      return publishResponse.data;
    }

    return response.data;
  } catch (error: any) {
    console.error("❌ Error creating entry:", error?.response?.data || error?.message || error);
    throw error;
  }
};
