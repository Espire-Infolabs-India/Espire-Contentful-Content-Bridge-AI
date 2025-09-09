// src/utils/cms.ts
import axios from "axios";

const SPACE_ID = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const ENVIRONMENT = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || "dev";
const TOKEN = process.env.NEXT_PUBLIC_CONTENTFUL_MANAGEMENT_TOKEN;

const BASE_URL = `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}`;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ✅ Fetch an entry by ID
export async function getEntry(entryId: string) {
  const res = await axios.get(`${BASE_URL}/entries/${entryId}`, { headers });
  return res.data;
}

// ✅ Publish an entry by ID (needs version)
export async function publishEntry(entryId: string, version: number) {
  return axios.put(`${BASE_URL}/entries/${entryId}/published`, {}, {
    headers: { ...headers, "X-Contentful-Version": version },
  });
}

// ✅ Extract nested entry IDs from an entry
export function getNestedEntryIds(entryData: any): string[] {
  const ids: string[] = [];
  for (const fieldKey of Object.keys(entryData.fields || {})) {
    const value = entryData.fields[fieldKey]["en-US"];
    if (value?.sys?.type === "Link" && value.sys.linkType === "Entry") {
      ids.push(value.sys.id);
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item?.sys?.type === "Link" && item.sys.linkType === "Entry") {
          ids.push(item.sys.id);
        }
      }
    }
  }
  return ids;
}

// ✅ Upload & process a file as an Asset
export async function uploadFileToContentful(file: File): Promise<string | null> {
  // Step 1: Upload raw file
  const uploadRes = await axios.post(
    `https://upload.contentful.com/spaces/${SPACE_ID}/uploads`,
    file,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
    }
  );

  const uploadId = uploadRes.data.sys.id;

  // Step 2: Create asset from upload
  const assetPayload = {
    fields: {
      title: { "en-US": file.name },
      file: {
        "en-US": {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          uploadFrom: { sys: { type: "Link", linkType: "Upload", id: uploadId } },
        },
      },
    },
  };

  const assetRes = await axios.post(`${BASE_URL}/assets`, assetPayload, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/vnd.contentful.management.v1+json",
    },
  });

  const assetId = assetRes.data.sys.id;
  const assetVersion = assetRes.data.sys.version;

  // Step 3: Process asset
  await axios.put(`${BASE_URL}/assets/${assetId}/files/en-US/process`, {}, {
    headers: { Authorization: `Bearer ${TOKEN}`, "X-Contentful-Version": assetVersion },
  });

  // Step 4: Poll until processed
  let processed = false;
  let retries = 10;
  let check: any;

  while (!processed && retries > 0) {
    await new Promise((res) => setTimeout(res, 2000));
    check = await axios.get(`${BASE_URL}/assets/${assetId}`, { headers });
    if (check.data.fields?.file?.["en-US"]?.url) processed = true;
    retries--;
  }

  if (!processed) return null;

  // Step 5: Publish asset
  await axios.put(`${BASE_URL}/assets/${assetId}/published`, {}, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "X-Contentful-Version": check.data.sys.version,
    },
  });

  return assetId;
}
