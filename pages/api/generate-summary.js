import { IncomingForm } from "formidable";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Prompt from "../../prompts.json";

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
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "Failed to parse form data" });
    }

    const templateName = fields?.template?.toString();
    const selectedModel =
      fields?.model?.toString().toLowerCase() || "gpt-3.5-turbo";
    const url = fields?.url?.toString();
    const file = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;

    console.log("Received template:", templateName);
    console.log("Selected model:", selectedModel);
    console.log("URL provided:", url);
    console.log("File provided:", file);

    if ((!file && !url) || (file && url)) {
      return res
        .status(400)
        .json({ error: "Provide either a PDF or a URL, not both" });
    }

    try {
      const spaceId = process.env.CONTENTFUL_SPACE_ID;
      const environmentId = process.env.CONTENTFUL_ENVIRONMENT || "dev";
      const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN;

      if (!process.env.BASE_URL) {
        throw new Error("Missing BASE_URL in environment");
      }

      console.log("Fetching content type:", templateName);

      const templateResponse = await axios.get(
        `https://api.contentful.com/spaces/${spaceId}/environments/${environmentId}/content_types/${templateName}`,
        {
          headers: {
            Authorization: `Bearer ${managementToken}`,
          },
        }
      );

      const schemas = templateResponse?.data?.fields;
      console.log("Fetched content type fields:", schemas);

      const referenceFieldsList = [];
      const fileFieldList = [];
      const fieldsToGenerate = [];
      const keyMap = {};

      await Promise.all(
        schemas?.map(async (field) => {
          if (!field?.id) return;

          keyMap[field.id] = field.name || field.id;
          fieldsToGenerate.push({
            id: field.id,
            name: field.name,
            type: field.type,
          });

          if (field?.type === "Link" && field?.linkType === "Entry") {
            const entryName = field?.validations?.find((v) => v.linkContentType)
              ?.linkContentType?.[0];
            if (entryName) {
              const getEntries = await fetch(
                `${process.env.BASE_URL}/api/get-content-entries/?content_name=${entryName}`
              );
              const getEntriesData = await getEntries.json();
              referenceFieldsList.push({
                displayName: field.name,
                key: entryName,
                values: getEntriesData?.entries,
                actual_uid: field.id,
              });
            }
          }

          if (field?.type === "Link" && field?.linkType === "Asset") {
            fileFieldList.push({
              displayName: field.name,
              actual_key: field.id,
            });
          }
        })
      );

      let truncatedContent = "";
      if (file?.mimetype === "application/pdf") {
        const filePath = file.filepath;
        const pdfContent = await readPDFContent(filePath);
        truncatedContent = pdfContent.slice(0, 30000);
        fs.unlink(filePath, () => { });
      } else if (url) {
        truncatedContent = url;
      }

      const prompt = `
${Prompt.promptText}

Instructions:
${Prompt.instructions.join("\n")}
7. For any fields of type RichText (e.g., description, content), only return plain text without formatting or JSON structure.

Fields to generate:
${fieldsToGenerate
          .map((f) => {
            if (f.type === "RichText") {
              return `${f.id} (plain text only)`;
            }
            return `${f.id} (${f.type})`;
          })
          .join("\n")}

Document:
${truncatedContent}
`;

      console.log("Prompt sent to model:", prompt);

      let rawOutput = "";
      if (selectedModel.includes("gemini")) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: selectedModel });
        const result = await model.generateContent(prompt);
        rawOutput = result.response
          .text()
          .replace(/^```json\n|```$/g, "")
          .trim();
      } else if (selectedModel.includes("gpt")) {
        const { OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const result = await openai.chat.completions.create({
          model: selectedModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        rawOutput = result.choices[0].message.content
          .replace(/^```json\n|```$/g, "")
          .trim();
      }

      console.log("⚡ Raw AI Output BEFORE PARSE:", rawOutput);

      let parsedOutput;
      try {
        const parsedTemp = JSON.parse(rawOutput);

        if (typeof parsedTemp !== "object" || parsedTemp === null) {
          throw new Error("Model output is not valid JSON");
        }

        parsedOutput = Object.entries(parsedTemp).map(([key, fieldValue]) => {
          const value =
            typeof fieldValue === "object" &&
              fieldValue !== null &&
              "value" in fieldValue
              ? fieldValue.value
              : fieldValue ?? "";

          return {
            key: keyMap[key] || key,
            actual_key: key,
            value,
          };
        });
      } catch (jsonErr) {
        console.error("Failed to parse model output:", jsonErr);
        return res.status(500).json({ error: "Model returned invalid JSON" });
      }

     return res.status(200).json({
  referenceFields: referenceFieldsList,
  fileFieldList: fileFieldList,
  summary: parsedOutput,
  allowedFields: fieldsToGenerate.map(f => f.id),  // Send only allowed field ids
});
    } catch (error) {
      console.error("Handler error:", error?.response?.data || error.message);
      return res
        .status(500)
        .json({ error: error.message || "Unexpected server error" });
    }
  });
}
