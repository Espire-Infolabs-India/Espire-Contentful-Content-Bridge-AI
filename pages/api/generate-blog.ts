import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure this is set in your .env file
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Simulate fetching webpage content (replace with real logic later)
    const fetchedContent = `Here is some placeholder content extracted from ${url}.`;

    // Generate blog using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates engaging blog posts.' },
        { role: 'user', content: `Generate a short blog based on this website content: ${fetchedContent}` },
      ],
    });

    const blogContent = completion.choices[0]?.message?.content || '';

    return res.status(200).json({ blog: blogContent });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ blog: 'Error generating content' });
  }
}
