import { IncomingForm } from "formidable";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Prompt from "../../prompts.json";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
    const selectedModel = req?.query?.model?.toString().toLowerCase() || "gpt-3.5-turbo";
    try {
      let value = req?.query?.value;
      const prompt = `
        Rephrase this to be easier to understand in single option: ${value}

        Fields to generate: {"title": value}
      `;
      
      let rawOutput = "";
      if (selectedModel.includes("gemini")) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: selectedModel });
        const result = await model.generateContent(prompt);
        rawOutput = result.response.text().replace(/^```json\n|```$/g, "").trim();
      } else if (selectedModel.includes("gpt")) {
        const { OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const result = await openai.chat.completions.create({
          model: selectedModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        });
        rawOutput = result.choices[0].message.content.replace(/^```json\n|```$/g, "").trim();
      }

      const parsedTemp = JSON.parse(rawOutput);
      res.status(200).json(parsedTemp);
    } catch (error) {
      return res.status(500).json({
        error: error.message || "Unexpected server error",
      });
    }
}
