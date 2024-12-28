import { useEffect, useState } from "react";

/**
 * This panel configures and updates the model with language-evaluation tools.
 * We define a "track_language_evaluation" function for the model to call
 * after each response. We can store or handle that data as needed.
 */

const evaluationTool = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "track_language_evaluation",
        description:
          "Must be called after every model response to track progress.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            phase_tracking: {
              type: "object",
              properties: {
                current_phase: {
                  type: "string",
                  enum: ["warmup", "basic", "intermediate", "advanced", "closing"]
                },
                time_elapsed: { type: "number" },
                topics_covered: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["current_phase", "time_elapsed", "topics_covered"]
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
                      items: { type: "string" }
                    }
                  },
                  required: ["score", "notes", "examples"]
                },
                grammar: {
                  type: "object",
                  properties: {
                    score: { type: "integer", minimum: 1, maximum: 5 },
                    notes: { type: "string" },
                    examples: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["score", "notes", "examples"]
                },
                vocabulary: {
                  type: "object",
                  properties: {
                    score: { type: "integer", minimum: 1, maximum: 5 },
                    notes: { type: "string" },
                    examples: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["score", "notes", "examples"]
                },
                fluency: {
                  type: "object",
                  properties: {
                    score: { type: "integer", minimum: 1, maximum: 5 },
                    notes: { type: "string" },
                    examples: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["score", "notes", "examples"]
                }
              },
              required: ["pronunciation", "grammar", "vocabulary", "fluency"]
            }
          },
          required: ["phase_tracking", "observations"]
        }
      }
    ],
    tool_choice: "auto",
    instructions: "You are a professional language evaluator. After each response, call track_language_evaluation with relevant observations. Only speak in the target language except for initial instructions."
  }
};

export default function EvaluationPanel({ isSessionActive, sendEventToModel, events }) {
  const [toolRegistered, setToolRegistered] = useState(false);

  // On session created from server => we can register our tool
  useEffect(() => {
    // If not active or already registered, do nothing
    if (!isSessionActive || toolRegistered) return;

    // Send the session.update to register the evaluation tool
    sendEventToModel(evaluationTool);
    setToolRegistered(true);
  }, [isSessionActive, toolRegistered, sendEventToModel]);

  useEffect(() => {
    if (!isSessionActive) {
      setToolRegistered(false);
    }
  }, [isSessionActive]);

  return (
    <div className="h-full p-4 bg-gray-100">
      <h2 className="text-lg font-bold mb-2">Evaluation Tool Status</h2>
      {isSessionActive ? (
        <div className="text-sm">
          <p>Tool has {toolRegistered ? "been registered" : "not registered"}.</p>
          <p>Check console events for calls to track_language_evaluation.</p>
        </div>
      ) : (
        <p className="text-gray-500">Session is not active...</p>
      )}
    </div>
  );
}
