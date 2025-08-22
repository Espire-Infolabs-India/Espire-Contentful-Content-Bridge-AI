import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import axios from "axios";

export const config = {
  api: {
    bodyParser: false,
  },
};

const isVercel = process.env.VERCEL === "1";
const uploadsDir = isVercel ? "/tmp" : path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function readPDFContent(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({
    uploadDir: uploadsDir,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err)
      return res.status(500).json({ error: "Failed to parse form data" });
    const url = fields?.url?.toString()?.trim() || null;
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;

    // 🔹 Get the selected AI model from frontend
    const selectedModel = fields?.model?.toString()?.trim()?.toLowerCase() || "azure";
    console.log("🤖 Selected AI Model:", selectedModel);

    if ((!file && !url) || (file && url)) {
      return res
        .status(400)
        .json({ error: "Provide either a PDF or a URL, not both" });
    }
    try {
      let contentForAzure = "";
      if (file?.mimetype === "application/pdf") {
        const filePath = file.filepath;
        contentForAzure = (await readPDFContent(filePath)).slice(0, 30000);
        fs.unlink(filePath, () => { });
      } else if (url && /^https?:\/\//i.test(url.trim())) {
        contentForAzure = url.trim();
      } else if (url) {
        return res
          .status(400)
          .json({
            error: "Invalid URL format. Must start with http:// or https://.",
          });
      }
      // ✅ Fix 1: Ensure contentForAzure is not empty
      if (
        !contentForAzure ||
        typeof contentForAzure !== "string" ||
        contentForAzure.trim() === ""
      ) {
        return res
          .status(400)
          .json({ error: "No valid content was provided for analysis." });
      }
      let contentTypeSchema = [];
      try {
        if (fields?.content_type) {
          const rawSchema = Array.isArray(fields.content_type)
            ? fields.content_type.join("")
            : fields.content_type.toString();
          contentTypeSchema = JSON.parse(rawSchema);

          //  Debug: List all field ids and names from the schema
          console.log("📥 Fetched Content Type Schema Fields:");
          for (const field of contentTypeSchema) {
            console.log(
              `🔧 Field ID: ${field.id}, Type: ${field.type}, Name: ${field.name}`
            );
            if (field.type === "Array" && Array.isArray(field.nestedFields)) {
              for (const nested of field.nestedFields) {
                console.log(
                  `   └─ Nested Field → ID: ${nested.id}, Type: ${nested.type}, Name: ${nested.name}`
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn(" Invalid content_type schema", err);
      }
      const contentTypeSchemas = contentTypeSchema
        .filter(
          (field) => field.type === "Array" && Array.isArray(field.nestedFields)
        )
        .map((field) => {
          const allowedTypes =
            field.validations?.find((v) => v.linkContentType)?.linkContentType || [
              `component${field.id.charAt(0).toUpperCase()}${field.id.slice(1)}`,
            ];

          return {
            id: field.id,
            display_name: field.name,
            type: field.type,
            items: {
              type: "Link",
              linkType: "Entry",
              validations: [{ linkContentType: allowedTypes }],
            },
          };
        });

      const simplifiedSchema = [];

      for (const field of contentTypeSchema) {
        // Case 1: Normal flat fields
        if (!field.type || field.type !== "Array") {
          simplifiedSchema.push({
            reference: field.id,
            display_name: field.display_name,
            helpText: field.helpText,
          });
          continue;
        }

        // Case 2: Inline nested fields (e.g., componentBlock)
        if (Array.isArray(field.nestedFields)) {
          for (const nested of field.nestedFields) {
            simplifiedSchema.push({
              reference: `${field.id}.${nested.from}.${nested.id}`, // ✅ use nested.from
              display_name: nested.display_name,
              helpText: nested.helpText,
              group: field.id,
              group_display_name: field.display_name,
              from: nested.from // ✅ keep real source

            });
          }
          continue;
        }

        // Case 3: Multi-reference fields (linked content types)
        if (field.items?.linkType === "Entry") {
          const linkedTypes = field.validations?.find((v) => v.linkContentType)?.linkContentType || [];

          for (const type of linkedTypes) {
            // Find the schema definition for this linked type
            const linkedSchema = contentTypeSchema.find(f => f.contentTypeId === type && Array.isArray(f.nestedFields));

            if (linkedSchema) {
              for (const nested of linkedSchema.nestedFields) {
                simplifiedSchema.push({
                  reference: `${field.id}.${nested.from}.${nested.id}`, // ✅ use nested.from
                  display_name: nested.display_name,
                  helpText: nested.helpText,
                  group: field.id,
                  group_display_name: field.display_name,
                  from: nested.from // ✅ keep real source

                });
              }
            } else {
              // If no nestedFields found, just include the whole group as-is
              simplifiedSchema.push({
                reference: field.id,
                display_name: field.display_name,
                helpText: field.helpText,
              });
            }
          }
          continue;
        }
      }

      // console.log("🔍 Final contentForAzure:", contentForAzure);
      //     console.log("📤 Sending to Azure:");
      let aiResponse;
      if (selectedModel === "gemini-2.0-flash") {
        console.log("🚀 Sending request to Gemini API...");
        aiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
          {
            contents: [
              {
                parts: [
                  {
                    text: `
You are an assistant that generates structured CMS content.

Here is the content type schema:
${JSON.stringify(simplifiedSchema, null, 2)}

Please generate values for EACH field in this schema.
Return the result STRICTLY as a valid JSON object where the keys EXACTLY match the schema field IDs.

Example output:
{
  "title": "My Page",
  "seo": { "title": "SEO title", "description": "SEO description" },
  "url": "/my-page",
  "sitemap": ["page"],
  "componentContainer": [],
  "site": "site1"
}

Input content:
${contentForAzure}
              `
                  }
                ]
              }
            ]
          },
          {
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY,
            },
          }
        );


      } else {
        aiResponse = await axios.post(
          "https://cms-bot-cbsyo.eastus2.inference.ml.azure.com/score",
          {
            blob_url: contentForAzure,
            user_prompt:
              "Rewrite in a more engaging style, but maintain all important details.",
            brand_website_url: "https://www.oki.com/global/profile/brand/",
            content_type: simplifiedSchema,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.AZURE_ML_API_KEY}`,
            },
          }
        );
      }
      console.log("📤 Payload being sent to Azure:");
      console.log(JSON.stringify({
        blob_url: contentForAzure,
        user_prompt: "Rewrite in a more engaging style, but maintain all important details.",
        brand_website_url: "https://www.oki.com/global/profile/brand/",
        content_type: simplifiedSchema,
      }, null, 2));

      let result;

      if (selectedModel === "gemini-2.0-flash") {
        // Gemini returns a different structure
        const geminiCandidates = aiResponse.data?.candidates;
        let geminiText = geminiCandidates?.[0]?.content?.parts?.[0]?.text;

        if (!geminiText) {
          throw new Error("Gemini response did not include any text");
        }

        // 🧹 Clean Gemini output (remove ```json ... ``` wrappers)
        geminiText = geminiText.replace(/```json|```/g, "").trim();

        try {
          // ✅ Try to parse Gemini's output as JSON (structured by schema)
          result = JSON.parse(geminiText);
        } catch (err) {
          console.error("⚠️ Gemini response was not valid JSON, using fallback:", geminiText);
          // Fallback to plain text so at least something is returned
          result = { generated_text: geminiText };
        }


      } else {
        // Azure response
        result = aiResponse.data.result;

        if (Array.isArray(result)) {
          const converted = {};
          for (const item of result) {
            if (item?.reference) {
              converted[item.reference] = item.value;
            }
          }
          result = converted;
        }



        // ✅ Step 2: Add log after conversion
        console.log("✅ Normalized result:", result);
      }
      const referenceFields = aiResponse.data.referenceFields || [];
      const fileFieldList = aiResponse.data.fileFieldList || [];
      const incomingAllowedFields = aiResponse.data.allowedFields || [];
      if (typeof result === "string") {
        try {
          result = JSON.parse(result);
        } catch (err) {
          return res.status(200).json({
            result: { error: `Invalid JSON from LLM: ${err.message}` },
            referenceFields: [],
            fileFieldList: [],
            allowedFields: [{ id: "error", type: "Text" }],
            nestedSchemas: {},
            contentTypeSchema,
          });
        }
      }

      for (const key in result) {
        if (typeof result[key] === "string") {
          try {
            const parsed = JSON.parse(result[key]);
            if (parsed && typeof parsed === "object") result[key] = parsed;
          } catch { }
        }
      }
      // 🔧 Unwrap any { value: "..." } pattern into raw string
      for (const key in result) {
        if (
          result[key] &&
          typeof result[key] === "object" &&
          "value" in result[key] &&
          Object.keys(result[key]).length === 1
        ) {
          result[key] = result[key].value;
        }
      }
      // Normalize nested array fields using contentTypeSchemas
      const nestedSchemas = Array.isArray(contentTypeSchema)
        ? contentTypeSchema
          .filter((field) => {
            const value = result[field.id];
            return (
              Array.isArray(value) &&
              value.length > 0 &&
              value.every(
                (entry) => typeof entry === "object" && !Array.isArray(entry)
              )
            );
          })
          .reduce((acc, field) => {
            const value = result[field.id];
            const arraySchema = contentTypeSchemas.find(
              (schema) => schema.id === field.id
            );

            if (!arraySchema) return acc;

            const nestedContentTypeId =
              arraySchema.items.validations[0].linkContentType[0];
            const entries = value.map((entry) => ({
              fields: Object.entries(entry).map(([actual_key, value]) => ({
                key: actual_key.replace(/([A-Z])/g, " $1").trim(),
                actual_key,
                value,
              })),
            }));

            acc[field.id] = { entries, contentTypeId: nestedContentTypeId, schema: field.nestedFields, };
            return acc;
          }, {})
        : {};

      const allowedFields =
        incomingAllowedFields.length > 0
          ? incomingAllowedFields
          : Object.keys(result || {});

      return res.status(200).json({
        result,
        referenceFields,
        fileFieldList,
        allowedFields,
        nestedSchemas,
        contentTypeSchema,
      });
    } catch (error) {
      console.error(" Handler error:", error?.response?.data || error.message);
      return res
        .status(500)
        .json({ error: error.message || "Unexpected server error" });
    }
  });
}
