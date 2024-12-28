export async function GET() {
  // Example route if using Astro for serverless
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview",
      voice: "verse"
    })
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
