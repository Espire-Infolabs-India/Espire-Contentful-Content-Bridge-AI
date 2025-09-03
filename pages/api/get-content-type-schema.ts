import { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// --- In-memory cache (persists for the lifetime of a serverless instance) ---
let cachedSchemas: Record<string, any> = {};
let cacheTimestamps: Record<string, number> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Cache for helpText maps to avoid duplicate API hits ---
let cachedHelpTextMaps: Record<string, Record<string, string>> = {};

// --- Global API request counter ---
let contentfulRequestCount = 0;
function logRequest(url: string) {
  contentfulRequestCount++;
}

// --- Throttled Contentful fetch with retry ---
const RATE_LIMIT_DELAY = 150; // ms between requests (≈7/sec, safe under 10/sec)
const MAX_RETRIES = 5;

async function fetchContentful(
  url: string,
  options: any,
  attempt = 1
): Promise<any> {
  logRequest(url);

  try {
    const res = await axios.get(url, options);

    // Throttle to avoid bursts
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));

    return res.data;
  } catch (err: any) {
    if (
      axios.isAxiosError(err) &&
      err.response?.data?.sys?.id === "RateLimitExceeded" &&
      attempt <= MAX_RETRIES
    ) {
      const waitTime = Math.pow(2, attempt) * 200;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return fetchContentful(url, options, attempt + 1);
    }

    throw err;
  }
}

// --- Helper: Recursively fetch content type schema ---
async function fetchFieldsFromContentType(
  contentTypeId: string,
  spaceId: string,
  environmentId: string,
  managementToken: string,
  nestedSchemas: Record<string, any>,
  visited = new Set<string>(),
  depth = 1
): Promise<any[]> {
  if (visited.has(contentTypeId)) return [];
  visited.add(contentTypeId);

  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}`;
  const data = await fetchContentful(url, {
    headers: { Authorization: `Bearer ${managementToken}` },
  });

  const fields = data.fields || [];
  nestedSchemas[contentTypeId] = fields;

  for (const field of fields) {
    field._depth = depth;
    let refTypes: string[] | undefined;

    if (field.type === "Link" && field.linkType === "Entry") {
      refTypes = field.validations?.find(
        (v: any) => v.linkContentType
      )?.linkContentType;
    }

    if (field.type === "Array" && field.items?.linkType === "Entry") {
      refTypes = field.items?.validations?.find(
        (v: any) => v.linkContentType
      )?.linkContentType;
    }

    if (refTypes) {
      for (const nestedType of refTypes) {
        await fetchFieldsFromContentType(
          nestedType,
          spaceId,
          environmentId,
          managementToken,
          nestedSchemas,
          visited,
          depth + 1
        );
      }
    }
  }

  return fields;
}

// --- Helper: Fetch helpText mapping with caching ---
async function fetchHelpTextMap(
  contentTypeId: string,
  spaceId: string,
  environmentId: string,
  managementToken: string
) {
  if (cachedHelpTextMaps[contentTypeId]) {
    return cachedHelpTextMaps[contentTypeId];
  }

  const url = `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${contentTypeId}/editor_interface`;
  const editorData = await fetchContentful(url, {
    headers: { Authorization: `Bearer ${managementToken}` },
  });

  const map: Record<string, string> = {};
  for (const control of editorData.controls || []) {
    if (control.fieldId && control.settings?.helpText) {
      map[control.fieldId] = control.settings.helpText;
    }
  }

  cachedHelpTextMaps[contentTypeId] = map; // cache it
  return map;
}

// --- Helper: Attach nested fields recursively ---
async function addNestedFields(
  parentField: any,
  refTypes: string[],
  nestedSchemas: Record<string, any>,
  spaceId: string,
  environmentId: string,
  managementToken: string
) {
  parentField.linkContentType = refTypes;
  parentField.nestedFields = [];

  for (const nestedType of refTypes) {
    const nestedFields = nestedSchemas[nestedType] || [];
    const nestedHelpTextMap = await fetchHelpTextMap(
      nestedType,
      spaceId,
      environmentId,
      managementToken
    );

    for (const nf of nestedFields) {
      const depth = (parentField._depth || 1) + 1;
      const nestedField: any = {
        id: nf.id,
        name: nf.name,
        display_name: nf.name,
        helpText: nestedHelpTextMap[nf.id] || "",
        type: nf.type,
        from: nestedType,
        _depth: depth,
        isTripleNested: depth === 3,
        dropdownContentTypes:
          nf.items?.validations?.find((v: any) => v.linkContentType)
            ?.linkContentType ||
          nf.validations?.find((v: any) => v.linkContentType)
            ?.linkContentType ||
          [],
      };

      if (depth >= 3) {
        parentField.nestedFields.push(nestedField);
        continue;
      }

      let childRefTypes: string[] | undefined;
      if (nf.type === "Link" && nf.linkType === "Entry") {
        childRefTypes = nf.validations?.find(
          (v: any) => v.linkContentType
        )?.linkContentType;
      }
      if (nf.type === "Array" && nf.items?.linkType === "Entry") {
        childRefTypes = nf.items?.validations?.find(
          (v: any) => v.linkContentType
        )?.linkContentType;
      }
      if (childRefTypes && childRefTypes.length > 0) {
        await addNestedFields(
          nestedField,
          childRefTypes,
          nestedSchemas,
          spaceId,
          environmentId,
          managementToken
        );
      }
      parentField.nestedFields.push(nestedField);
    }
  }
}

// --- API Handler ---
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { template } = req.query;

  if (!template || typeof template !== "string") {
    return res
      .status(400)
      .json({ error: "Missing content type ID (`template`)" });
  }

  try {
    const spaceId = process.env.CONTENTFUL_SPACE_ID!;
    const environmentId = process.env.CONTENTFUL_ENVIRONMENT || "dev";
    const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN!;

    const now = Date.now();
    if (
      cachedSchemas[template] &&
      now - cacheTimestamps[template] < CACHE_TTL
    ) {
      return res
        .status(200)
        .json({ schema: cachedSchemas[template], cached: true });
    }

    // Fetch schema from Contentful
    const nestedSchemas: Record<string, any> = {};
    const rootFields = await fetchFieldsFromContentType(
      template,
      spaceId,
      environmentId,
      managementToken,
      nestedSchemas
    );
    const helpTextMap = await fetchHelpTextMap(
      template,
      spaceId,
      environmentId,
      managementToken
    );

    const simplifiedSchema: any[] = [];
    for (const field of rootFields) {
      const simplifiedField: any = {
        id: field.id,
        name: field.name,
        display_name: field.name,
        helpText: helpTextMap[field.id] || "",
        type: field.type,
        _depth: field._depth || 1,
        isTripleNested: (field._depth || 1) >= 3,
        dropdownContentTypes:
          field.items?.validations?.find((v: any) => v.linkContentType)
            ?.linkContentType ||
          field.validations?.find((v: any) => v.linkContentType)
            ?.linkContentType ||
          [],
      };

      let refTypes: string[] | undefined;
      if (field.type === "Link" && field.linkType === "Entry") {
        refTypes = field.validations?.find(
          (v: any) => v.linkContentType
        )?.linkContentType;
      }
      if (field.type === "Array" && field.items?.linkType === "Entry") {
        refTypes = field.items?.validations?.find(
          (v: any) => v.linkContentType
        )?.linkContentType;
      }

      if (refTypes && refTypes.length > 0) {
        await addNestedFields(
          simplifiedField,
          refTypes,
          nestedSchemas,
          spaceId,
          environmentId,
          managementToken
        );
      }

      simplifiedSchema.push(simplifiedField);
    }

    cachedSchemas[template] = simplifiedSchema;
    cacheTimestamps[template] = now;

    return res.status(200).json({ schema: simplifiedSchema, cached: false });
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error("❌ Axios error:", error.response?.data || error.message);
      if (error.response?.data?.sys?.id === "RateLimitExceeded") {
        return res.status(429).json({
          error: "Rate limit exceeded, please try again later",
          details: error.response.data,
        });
      }
    } else {
      console.error("❌ Error:", error.message || error);
    }

    return res
      .status(500)
      .json({ error: "Failed to fetch content type schema" });
  }
}
