import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function parseImageWithVision(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "[]";

  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();

  return cleaned;
}
