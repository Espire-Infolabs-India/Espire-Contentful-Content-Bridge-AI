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

// ✅ Normalize schema to include display_name
function enrichSchemaWithDisplayNameAndHelpText(schema) {
  return schema.map((field) => {
    const enrichedField = {
      ...field,
      display_name: field.name || field.id,
      helpText: field.helpText ?? null,
    };

    if (field.type === "Array" && Array.isArray(field.nestedFields)) {
      enrichedField.nestedFields = field.nestedFields.map((nested) => ({
        ...nested,
        display_name: nested.name || nested.id,
        helpText: nested.helpText ?? null,
      }));
    }

    return enrichedField;
  });
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
        fs.unlink(filePath, () => {});
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
          console.log("🧪 Raw content_type BEFORE enrichment:\n", rawSchema);

          contentTypeSchema =
            enrichSchemaWithDisplayNameAndHelpText(contentTypeSchema);
          console.log(
            "🧪 Parsed contentTypeSchema BEFORE enrichment:\n",
            JSON.stringify(contentTypeSchema, null, 2)
          );

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
          const linkContentTypeId =
            field.linkContentTypeId ||
            `component${field.id.charAt(0).toUpperCase()}${field.id.slice(1)}`;
          console.log(
            `🧩 linkContentTypeId for "${field.id}" →`,
            linkContentTypeId
          );

          return {
            id: field.id,
            display_name: field.name,
            type: field.type,
            items: {
              type: "Link",
              linkType: "Entry",
              validations: [{ linkContentType: [linkContentTypeId] }],
            },
          };
        });

      // 🔁 Add group info for nested fields
      const simplifiedSchema = [];
      for (const field of contentTypeSchema) {
        if (field.type === "Array" && field.nestedFields) {
          for (const nestedField of field.nestedFields) {
            simplifiedSchema.push({
              reference: `${field.id}.${nestedField.id}`,
              display_name: nestedField.display_name,
              helpText: nestedField.helpText,
              group: field.id,
              group_display_name: field.display_name,
            });
          }
        } else {
          simplifiedSchema.push({
            reference: field.id,
            display_name: field.display_name,
            helpText: field.helpText,
          });
        }
      }
console.log("🔍 Final contentForAzure:", contentForAzure);
      // ✅ Log and send to Azure
      console.log("📤 Sending to Azure:");

      const azureResponse = await axios.post(
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
console.log("📤 Payload being sent to Azure:");
console.log(JSON.stringify({
  blob_url: contentForAzure,
  user_prompt: "Rewrite in a more engaging style, but maintain all important details.",
  brand_website_url: "https://www.oki.com/global/profile/brand/",
  content_type: simplifiedSchema,
}, null, 2));

      let result = azureResponse.data.result;

      if (Array.isArray(result)) {
        const converted = {};
        for (const item of result) {
          if (item?.reference) {
            converted[item.reference] = item.value;
          }
        }
        result = converted;

        // ✅ Step 2: Add log after conversion
        console.log("✅ Normalized result:", result);
      }

      const referenceFields = azureResponse.data.referenceFields || [];
      const fileFieldList = azureResponse.data.fileFieldList || [];
      const incomingAllowedFields = azureResponse.data.allowedFields || [];

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
          } catch {}
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

              acc[field.id] = { entries, contentTypeId: nestedContentTypeId,schema: field.nestedFields,};
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
