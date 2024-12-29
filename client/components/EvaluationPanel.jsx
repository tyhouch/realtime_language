import { useEffect, useState } from "react";

/**
 * This panel registers the "track_language_evaluation" tool,
 * then sends an initial system message prompting the model
 * to begin the evaluation, asking it to call that tool every turn.
 */
export default function EvaluationPanel({
  isSessionActive,
  sendEventToModel,
  events,
  evaluationResults,
  sessionConfig,
}) {
  const [toolRegistered, setToolRegistered] = useState(false);

  // The tool schema: it must supply "phase_tracking" + "observations"
  // after every response, capturing scores, notes, etc.
  const evaluationTool = {
    type: "session.update",
    session: {
      tools: [
        {
          type: "function",
          name: "track_language_evaluation",
          description:
            "A function you MUST call after every assistant message. Provide your current phase, time_elapsed, topics covered, and skill observations.",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              phase_tracking: {
                type: "object",
                properties: {
                  current_phase: {
                    type: "string",
                    enum: [
                      "warmup",
                      "basic",
                      "intermediate",
                      "advanced",
                      "closing",
                    ],
                    description:
                      "Which phase are we in? Must be one of warmup, basic, intermediate, advanced, or closing.",
                  },
                  time_elapsed: {
                    type: "number",
                    description: "Approximate seconds elapsed in the eval.",
                  },
                  topics_covered: {
                    type: "array",
                    items: { type: "string" },
                    description:
                      "Array of topics or prompts covered in this exchange.",
                  },
                },
                required: ["current_phase", "time_elapsed", "topics_covered"],
              },
              observations: {
                type: "object",
                properties: {
                  pronunciation: {
                    type: "object",
                    properties: {
                      score: { type: "integer", minimum: 1, maximum: 5 },
                      notes: { type: "string" },
                      examples: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["score", "notes", "examples"],
                  },
                  grammar: {
                    type: "object",
                    properties: {
                      score: { type: "integer", minimum: 1, maximum: 5 },
                      notes: { type: "string" },
                      examples: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["score", "notes", "examples"],
                  },
                  vocabulary: {
                    type: "object",
                    properties: {
                      score: { type: "integer", minimum: 1, maximum: 5 },
                      notes: { type: "string" },
                      examples: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["score", "notes", "examples"],
                  },
                  fluency: {
                    type: "object",
                    properties: {
                      score: { type: "integer", minimum: 1, maximum: 5 },
                      notes: { type: "string" },
                      examples: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["score", "notes", "examples"],
                  },
                },
                required: ["pronunciation", "grammar", "vocabulary", "fluency"],
              },
            },
            required: ["phase_tracking", "observations"],
          },
        },
      ],
      tool_choice: "auto",
      instructions: `
        You are a ${sessionConfig.language} language evaluation assistant. 
        Each time you respond, you MUST call track_language_evaluation 
        with JSON describing the user's performance so far. 
        Keep your responses concise and direct; let the user do most of the talking. 
        Move from warmup->basic->intermediate->advanced->closing phases as time passes. 
        Only speak in ${sessionConfig.language} (after your first introduction).
      `,
    },
  };

  useEffect(() => {
    if (!isSessionActive || toolRegistered) return;

    // Step 1: register the tool
    sendEventToModel(evaluationTool);
    setToolRegistered(true);

    // Step 2: send initial system message
    setTimeout(() => {
      sendEventToModel({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [
            {
              type: "text",
              text: `
                You are conducting a ${sessionConfig.durationMinutes}-minute ${sessionConfig.language} evaluation. 
                Briefly introduce yourself in English, then switch to ${sessionConfig.language}. 
                ALWAYS call track_language_evaluation after every message you produce.
                Keep answers short, prompting the user to speak.
              `,
            },
          ],
        },
      });

      // Step 3: ask model for first response
      sendEventToModel({
        type: "response.create",
        response: {
          function_call: "auto",
        },
      });
    }, 500);
  }, [isSessionActive, toolRegistered, sendEventToModel, sessionConfig]);

  // If session stops, reset so we can do it again
  useEffect(() => {
    if (!isSessionActive) {
      setToolRegistered(false);
    }
  }, [isSessionActive]);

  /**
   * Render function for skill scores
   */
  function renderSkillScore(skill, score) {
    return (
      <div className="flex items-center gap-2 mb-2">
        <div className="w-24 font-medium">{skill}:</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`w-4 h-4 rounded-full ${
                n <= score ? "bg-green-500" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Show the last evaluation result on top
  const latestEvaluation = evaluationResults[evaluationResults.length - 1];

  return (
    <div className="h-full p-4 bg-gray-100 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Evaluation Progress</h2>
      {isSessionActive ? (
        <>
          <div className="mb-2 text-sm">
            Tool registered: {toolRegistered ? "Yes" : "No"}
          </div>
          <div className="mb-4 text-sm">
            Evaluations recorded: {evaluationResults.length}
          </div>

          {latestEvaluation && (
            <div className="bg-white rounded p-4 mb-4">
              <h3 className="text-sm font-bold mb-2">Latest Evaluation</h3>
              <div className="mb-2">
                <span className="font-medium text-sm">Phase:</span>{" "}
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                  {latestEvaluation.phase_tracking.current_phase}
                </span>
              </div>

              <div className="mb-2">
                <div className="text-sm font-medium">Skills Assessment:</div>
                {renderSkillScore(
                  "Pronunciation",
                  latestEvaluation.observations.pronunciation.score
                )}
                {renderSkillScore(
                  "Grammar",
                  latestEvaluation.observations.grammar.score
                )}
                {renderSkillScore(
                  "Vocabulary",
                  latestEvaluation.observations.vocabulary.score
                )}
                {renderSkillScore(
                  "Fluency",
                  latestEvaluation.observations.fluency.score
                )}
              </div>

              <div className="mb-2">
                <div className="text-sm font-medium">Topics Covered:</div>
                <div className="flex flex-wrap gap-1">
                  {latestEvaluation.phase_tracking.topics_covered.map(
                    (topic, i) => (
                      <span
                        key={i}
                        className="bg-gray-100 px-2 py-1 rounded text-xs"
                      >
                        {topic}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Time elapsed: {latestEvaluation.phase_tracking.time_elapsed}s
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">Session is not active.</p>
      )}
    </div>
  );
}
