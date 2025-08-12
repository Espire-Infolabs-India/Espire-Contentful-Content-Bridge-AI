import { contentfulClient } from "../lib/ContentfulClient";

export type SafeContentfulInfo = {
  spaceId: string;
  environmentId: string;
  deliveryToken: string;
  spaceName: string;
};

export async function getContentfulInfo(): Promise<SafeContentfulInfo | null> {
  try {
    const client = contentfulClient();

    // Fetch general space metadata
    const space = await client.getSpace();
    const spaceId = space.sys.id;
    const spaceName = space.name;

    // Environment info is not available directly through this client,
    // so we fallback to the env var
    const environmentId = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "master";
    const deliveryToken = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN!;

    return {
      spaceId,
      spaceName,
      environmentId,
      deliveryToken,
    };
  } catch (error) {
    console.error("Error fetching Contentful info:", error);
    return null;
  }
}
