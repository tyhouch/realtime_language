# Language Evaluation Tool

This project demonstrates a real-time language evaluation system using OpenAI's Realtime API. It establishes a low-latency audio conversation via WebRTC and uses function calling for continuous assessment of the user's language proficiency.

## Project Structure

- **server.js**: Node.js server (using Fastify) for creating ephemeral tokens and serving the React app.
- **client/**: React client that sets up the WebRTC connection, captures audio, and interacts with the Realtime API.
- **src/**: Additional optional Astro-based layout files (not required by the core React app).

## Prerequisites

- Node.js >= 16
- An OpenAI API Key (export it to OPENAI_API_KEY in your environment)
- Internet access to reach OpenAI's Realtime API

## Running the App

1. `npm install`
2. `export OPENAI_API_KEY=your_api_key`
3. `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) to use the Language Evaluation Tool.

## License

MIT
