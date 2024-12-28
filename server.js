import Fastify from "fastify";
import FastifyVite from "@fastify/vite";

const server = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
});

await server.register(FastifyVite, {
  root: import.meta.url,
  renderer: "@fastify/react",
});


await server.vite.ready();

// Returns an ephemeral token to connect to OpenAI Realtime API
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

await server.listen({ port: process.env.PORT || 3000 });
