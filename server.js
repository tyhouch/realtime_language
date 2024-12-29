import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import OpenAI from "openai";

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
 *    with structured output from GPT-4o style models
 */
server.post("/finalEvaluation", async (req, reply) => {
  try {
    const { conversation } = req.body; // Expecting array of messages { role: 'user'|'assistant', text: string }

    if (!conversation) {
      return reply
        .status(400)
        .send({ error: "Missing conversation in request body" });
    }

    // 4a) Create an OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * 4b) We'll call a GPT-4o model with "response_format"=json_schema
     * providing a structured JSON schema. 
     * Example: We want a final rating (1-10), 
     * a short "overall_summary", and any "strengths" or "weaknesses" arrays.
     */

    const messages = [
      {
        role: "system",
        content: `You are a language evaluation assistant. 
        The user and assistant had a conversation in some target language. 
        We want a final structured evaluation with these required fields:
        1) overall_summary: short text summary
        2) rating: integer from 1 to 10
        3) strengths: array of strings
        4) weaknesses: array of strings
        
        Output must strictly follow this JSON schema:
        {
          "type": "object",
          "properties": {
            "overall_summary": {
              "type": "string"
            },
            "rating": {
              "type": "integer"
            },
            "strengths": {
              "type": "array",
              "items": { "type": "string" }
            },
            "weaknesses": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "required": ["overall_summary", "rating", "strengths", "weaknesses"],
          "additionalProperties": false
        }
        
        The conversation so far is below:
        `,
      },
      {
        role: "user",
        content: conversation
          .map((c) => `[${c.role.toUpperCase()}]: ${c.text}`)
          .join("\n"),
      },
    ];

    // 4c) Call the Chat API using "json_schema" response format
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or whichever GPT-4o model
      messages: messages,
      // JSON mode or "structured outputs" format:
      // If you have a more advanced approach with the openai-node "beta" client, use that. 
      // For simplicity, we'll just instruct the model to produce valid JSON.
      // Alternatively: see docs on function calling or structured outputs with strict schema.
      temperature: 0.2,
      max_tokens: 300,
      // "response_format" is only recognized by the "beta" or "assistants" endpoints. 
      // We'll do a simpler approach: we strongly instruct the model to return JSON, 
      // then parse it below. 
    });

    const rawText = completion.choices[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      // If the model doesn't produce valid JSON, handle gracefully
      return reply.status(200).send({
        success: false,
        rawText,
        error: "Model did not produce valid JSON. See rawText for debugging.",
      });
    }

    // 4d) Return structured JSON to client
    return { success: true, evaluation: parsed };
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
