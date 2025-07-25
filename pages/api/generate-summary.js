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

function generateFieldDescriptions(schema) {
  const descriptions = {};
  for (const field of schema) {
    if (field.type === "Array" && Array.isArray(field.nestedFields)) {
      for (const nestedField of field.nestedFields) {
        const key = `${field.id}.${nestedField.id}`;
        descriptions[key] = nestedField.name;
      }
    } else {
      descriptions[field.id] = field.name;
    }
  }
  return descriptions;
}

function generateFieldTypeInstructions(schema) {
  const instructions = [];
  for (const field of schema) {
    const { id, type } = field;
    if (type === "Date") instructions.push(`- For "${id}" (Date): extract or infer a publishable date in YYYY-MM-DD format.`);
    else if (type === "Slug") instructions.push(`- For "${id}" (Slug): generate a clean, hyphenated slug based on the title or topic.`);
    else if (type === "Boolean") instructions.push(`- For "${id}" (Boolean): return true or false (not strings).`);
    else if (type === "RichText") instructions.push(`- For "${id}" (RichText): return long-form paragraph text.`);
    else if (type === "Url") instructions.push(`- For "${id}" (Url): infer a relevant web URL if mentioned.`);
    else if (type === "Array" && Array.isArray(field.nestedFields)) {
      for (const nf of field.nestedFields) {
        const nestedId = `${id}.${nf.id}`;
        if (nf.type === "Url") instructions.push(`- For "${nestedId}" (Url): infer a relevant URL.`);
        else if (nf.type === "Boolean") instructions.push(`- For "${nestedId}" (Boolean): return true or false.`);
        else if (nf.type === "Slug") instructions.push(`- For "${nestedId}" (Slug): generate a clean slug.`);
        else if (nf.type === "Date") instructions.push(`- For "${nestedId}" (Date): extract a publishable date.`);
      }
    }
  }
  return instructions;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({ uploadDir: uploadsDir, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Failed to parse form data" });

    const url = fields?.url?.toString();
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;

    if ((!file && !url) || (file && url)) {
      return res.status(400).json({ error: "Provide either a PDF or a URL, not both" });
    }

    try {
      let contentForAzure = "";
      if (file?.mimetype === "application/pdf") {
        const filePath = file.filepath;
        contentForAzure = (await readPDFContent(filePath)).slice(0, 30000);
        fs.unlink(filePath, () => {});
      } else if (url) {
        contentForAzure = url;
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
            console.log(`🔧 Field ID: ${field.id}, Type: ${field.type}, Name: ${field.name}`);
            if (field.type === "Array" && Array.isArray(field.nestedFields)) {
              for (const nested of field.nestedFields) {
                console.log(`   └─ Nested Field → ID: ${nested.id}, Type: ${nested.type}, Name: ${nested.name}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn(" Invalid content_type schema", err);
      }

      const contentTypeSchemas = [ 
         {
          id: "productBanner",
          name: "Product Banner",
          type: "Array",
          items: {
            type: "Link",
            linkType: "Entry",
            validations: [{ linkContentType: ["componentProductBanner"] }],
          },
        }
      ];

      const fieldDescriptions = generateFieldDescriptions(contentTypeSchema);
      const typeInstructions = generateFieldTypeInstructions(contentTypeSchema);
      const formattedDescriptions = Object.entries(fieldDescriptions)
        .map(([key, label]) => `- ${key}: ${label}`)
        .join("\n");

 const systemPrompt = `
You are a Contentful content generator.

Rewrite the content in a highly engaging tone — creative but professional — while strictly adhering to the following Contentful schema.

Schema:
${formattedDescriptions}

Type Instructions:
${typeInstructions.join("\n")}

Strict Rules:
- You MUST include **every field** exactly as specified in the schema — no missing keys.
- All field names are **case-sensitive** and must match the schema **exactly**.
- Do NOT leave any field blank — infer or generate realistic values for everything.
- For **RichText** fields (like "description", "content", etc.), return them as **plain string content** — the backend will handle conversion to RichText JSON.
- For **Array fields** like "productBanner", return **at least 1 item** with all its nested fields filled.
- For "Slug", "URL", and "Publish Date" fields, generate realistic and unique values.
- DO NOT include any markdown, comments, explanations, or extra output — return only a valid, minified JSON object.

Return ONLY a single valid JSON object. No markdown, no code fences, no explanation.
`;

      const azureResponse = await axios.post(
        "https://cms-auto-agent-mobmv.eastus2.inference.ml.azure.com/score",
        {
          blob_url: contentForAzure,
          user_prompt: systemPrompt,
          brand_website_url: "https://www.oki.com/global/profile/brand/",
          content_type: contentTypeSchema,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.AZURE_ML_API_KEY}`,
          },
        }
      );

      let result = azureResponse.data.result;
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
                value.every((entry) => typeof entry === "object" && !Array.isArray(entry))
              );
            })
            .reduce((acc, field) => {
              const value = result[field.id];
              const arraySchema = contentTypeSchemas.find((schema) => schema.id === field.id);

              if (!arraySchema) return acc;

              const nestedContentTypeId = arraySchema.items.validations[0].linkContentType[0];
              const entries = value.map((entry) => ({
                fields: Object.entries(entry).map(([actual_key, value]) => ({
                  key: actual_key.replace(/([A-Z])/g, " $1").trim(),
                  actual_key,
                  value,
                })),
              }));

              acc[field.id] = { entries, contentTypeId: nestedContentTypeId };
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
      return res.status(500).json({ error: error.message || "Unexpected server error" });
    }
  });
}
