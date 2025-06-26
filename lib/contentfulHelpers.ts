// helper/index.ts
import { contentfulClient } from "../lib/ContentfulClient";

export const getBlogPosts = async () => {
  const client = contentfulClient();
  try {
    const response = await client.getEntries({
      content_type: "componentBlogPostAi", // your content type UID
     // order: "-fields.publishDate", // optional: sort by publishDate descending
      limit: 10, // optional: limit number of entries
    });
    return response.items;
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
};
