import { contentfulClient } from "../lib/ContentfulClient";
import { FooterProps, HeaderProps } from "../typescript/layout";
import { Page, BlogPosts } from "../typescript/pages";

export const getEntriesByContentType = async (
  contentType: string,
  queryParams: Record<string, any> = {}
) => {
  const client = contentfulClient();
  try {
    const response = await client.getEntries({
      content_type: contentType,
      ...queryParams,
    });
    return response.items;
  } catch (error) {
    console.error(`Error fetching entries for ${contentType}:`, error);
    return [];
  }
};

export const getEntryBySlug = async (contentType: string, slug: string) => {
  const client = contentfulClient();
  try {
    const response = await client.getEntries({
      content_type: contentType,
      "fields.url": slug,
      limit: 1,
    });
    return response.items[0] || null;
  } catch (error) {
    console.error(`Error fetching entry for ${contentType} with slug ${slug}:`, error);
    return null;
  }
};

export const getHeaderResponse = async (): Promise<HeaderProps | null> => {
  const entries = await getEntriesByContentType("componentHeader");
  return entries.length > 0 ? (entries[0].fields as unknown as HeaderProps) : null;
};

export const getFooterRes = async (): Promise<FooterProps | null> => {
  const entries = await getEntriesByContentType("componentFooter");
  return entries.length > 0 ? (entries[0].fields as unknown as FooterProps) : null;
};

export const getAllEntries = async (): Promise<Page[]> => {
  const entries = await getEntriesByContentType("blogLandingPage");
  return entries.map((item) => item.fields) as unknown as Page[];
};

export const getPageRes = async (entryUrl: string): Promise<Page | null> => {
  const entry = await getEntryBySlug("blogLandingPage", entryUrl);
  return entry ? (entry.fields as unknown as Page) : null;
};

export const getBlogListRes = async (): Promise<BlogPosts[]> => {
  const entries = await getEntriesByContentType("componentBlogPostAi", {
    include: 2,
    order: "-fields.publishDate",
  });
  return entries.map((item) => item.fields) as BlogPosts[];
};

export const getBlogPostRes = async (entryUrl: string): Promise<BlogPosts | null> => {
  const entry = await getEntryBySlug("componentBlogPostAi", entryUrl);
  return entry ? (entry.fields as BlogPosts) : null;
};
