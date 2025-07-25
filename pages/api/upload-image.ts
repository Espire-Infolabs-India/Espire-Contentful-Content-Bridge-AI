import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

const SPACE_ID = process.env.CONTENTFUL_SPACE_ID!;
const ENVIRONMENT = process.env.CONTENTFUL_ENVIRONMENT || "dev";
const CMA_TOKEN = process.env.CONTENTFUL_MANAGEMENT_API_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Form parse error", err);
      return res.status(500).json({ message: "Form parsing failed", error: err.message });
    }

    const file = files.file as any;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const buffer = fs.readFileSync(file.filepath);
    const fileName = file.originalFilename;
    const mimeType = file.mimetype;

    try {
      // 1. Upload raw file
      const uploadRes = await fetch(
        `https://upload.contentful.com/spaces/${SPACE_ID}/uploads`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CMA_TOKEN}`,
            "Content-Type": "application/octet-stream",
          },
          body: buffer,
        }
      );

      const uploadData = await uploadRes.json();
      const uploadId = uploadData.sys.id;

      // 2. Create asset
      const assetRes = await fetch(
        `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/assets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CMA_TOKEN}`,
            "Content-Type": "application/vnd.contentful.management.v1+json",
          },
          body: JSON.stringify({
            fields: {
              title: { "en-US": fileName },
              file: {
                "en-US": {
                  fileName,
                  contentType: mimeType,
                  uploadFrom: {
                    sys: {
                      type: "Link",
                      linkType: "Upload",
                      id: uploadId,
                    },
                  },
                },
              },
            },
          }),
        }
      );

      const asset = await assetRes.json();
      const assetId = asset.sys.id;

      // 3. Process asset
      await fetch(
        `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/assets/${assetId}/files/en-US/process`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${CMA_TOKEN}`,
          },
        }
      );

      // 4. Poll until processing completes
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let processedAsset = null;
      const maxRetries = 20;

      for (let i = 0; i < maxRetries; i++) {
        const checkRes = await fetch(
          `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/assets/${assetId}`,
          {
            headers: {
              Authorization: `Bearer ${CMA_TOKEN}`,
            },
          }
        );

        processedAsset = await checkRes.json();

        const maybeUrl = processedAsset?.fields?.file?.["en-US"]?.url;

        console.log(`⏳ [Retry ${i + 1}]`, maybeUrl ? `✅ URL: ${maybeUrl}` : "Processing...");

        if (maybeUrl) break;

        await wait(1500);
      }

      const finalUrl = processedAsset?.fields?.file?.["en-US"]?.url;

      if (!finalUrl) {
        console.error("❌ Still no URL after retries", processedAsset);
        throw new Error("File processing timeout");
      }

      // 5. Publish asset
      await fetch(
        `https://api.contentful.com/spaces/${SPACE_ID}/environments/${ENVIRONMENT}/assets/${assetId}/published`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${CMA_TOKEN}`,
          },
        }
      );

      return res.status(200).json({
        assetId,
        url: `https:${finalUrl}`,
        title: processedAsset.fields.title["en-US"],
      });
    } catch (err: any) {
      console.error("❌ Upload failed", err);
      return res.status(500).json({
        message: "Upload failed",
        error: err.message || err.toString(),
        stack: err.stack,
      });
    }
  });
}
