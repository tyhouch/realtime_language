import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

// 1) Initialize Fastify
const server = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
});

// 2) Register @fastify/vite (front-end SSR)
await server.register(FastifyVite, {
  root: import.meta.url,
  renderer: "@fastify/react",
});

await server.vite.ready();

/**
 * 3) Route: ephemeral token for Realtime API
 */
server.get("/token", async () => {
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview",
      voice: "verse",
    }),
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * 4) Route: finalEvaluation
 *    Uses the conversation text to produce a language evaluation
 *    with structured output from GPT-4o style models.
 */
server.post("/finalEvaluation", async (req, reply) => {
  try {
    const { conversation } = req.body;

    if (!conversation) {
      return reply
        .status(400)
        .send({ error: "Missing conversation in request body" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define our evaluation schema using zod
    const EvaluationSchema = z.object({
      overall_summary: z.string(),
      rating: z.number().int().min(1).max(10),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
    });

    // We provide a more explicit system message to reflect a job interview scenario
    const systemPrompt = `
      You are a formal language evaluation assistant for a mock job interview scenario. 
      The user and assistant engaged in a conversation in order to assess the user's spoken language proficiency.
      Now, based on the entire conversation transcript, produce a short structured evaluation with:
      - overall_summary (concise text describing performance)
      - rating (integer 1-10)
      - strengths (array of short bullet points)
      - weaknesses (array of short bullet points)
      Make sure to be fair, consistent, and professional in your assessment.
    `;

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: conversation
            .map((c) => `[${c.role.toUpperCase()}]: ${c.text}`)
            .join("\n"),
        },
      ],
      response_format: zodResponseFormat(EvaluationSchema, "evaluation"),
      temperature: 0.2,
      max_tokens: 3000,
    });

    const evaluation = completion.choices[0].message.parsed;
    return { success: true, evaluation };
  } catch (err) {
    reply.status(500).send({
      error: err.message,
    });
  }
});

/**
 * 5) Start listening
 */
await server.listen({ port: process.env.PORT || 3000 });
