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

export default function EvaluationPanel({ 
  isSessionActive, 
  sendEventToModel, 
  events,
  evaluationResults 
}) {
  const [toolRegistered, setToolRegistered] = useState(false);

  useEffect(() => {
    if (!isSessionActive || toolRegistered) return;

    // Add logging to verify tool registration
    console.log('Registering evaluation tool...');
    
    // Send the session.update to register the evaluation tool
    sendEventToModel(evaluationTool);
    setToolRegistered(true);

    // Add conversation starter with a small delay
    setTimeout(() => {
      console.log('Sending initial conversation prompt...');
      sendEventToModel({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{
            type: "text",
            text: `You are conducting a 5-minute Chinese language evaluation. 
                  Begin by introducing yourself in English and explaining how 
                  the evaluation will work. After that, conduct the entire 
                  evaluation in Chinese.
                  
                  Remember to:
                  1. Call track_language_evaluation after every response
                  2. Progress through phases based on user ability
                  3. Keep track of time
                  4. Make detailed observations about pronunciation, grammar, vocabulary, and fluency`
          }]
        }
      });

      // Trigger the model to start responding
      sendEventToModel({
        type: "response.create"
      });
    }, 500);
  }, [isSessionActive, toolRegistered, sendEventToModel]);

  useEffect(() => {
    if (!isSessionActive) {
      setToolRegistered(false);
    }
  }, [isSessionActive]);

  useEffect(() => {
    if (!isSessionActive) {
      setToolRegistered(false);
    }
  }, [isSessionActive]);

  function renderSkillScore(skill, score) {
    return (
      <div className="flex items-center gap-2 mb-2">
        <div className="w-24 font-medium">{skill}:</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div 
              key={n}
              className={`w-4 h-4 rounded-full ${
                n <= score ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  const latestEvaluation = evaluationResults[evaluationResults.length - 1];

  return (
    <div className="h-full p-4 bg-gray-100 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Evaluation Progress</h2>
      
      {isSessionActive ? (
        <>
          <div className="mb-4">
            <p className="text-sm">
              Tool status: {toolRegistered ? "Registered" : "Not registered"}
            </p>
            <p className="text-sm">
              Evaluations recorded: {evaluationResults.length}
            </p>
          </div>

          {latestEvaluation && (
            <div className="bg-white rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">Latest Evaluation</h3>
              <div className="mb-4">
                <div className="text-sm font-medium mb-1">Phase:</div>
                <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block">
                  {latestEvaluation.phase_tracking.current_phase}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Skills Assessment:</div>
                {renderSkillScore('Pronunciation', latestEvaluation.observations.pronunciation.score)}
                {renderSkillScore('Grammar', latestEvaluation.observations.grammar.score)}
                {renderSkillScore('Vocabulary', latestEvaluation.observations.vocabulary.score)}
                {renderSkillScore('Fluency', latestEvaluation.observations.fluency.score)}
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-1">Topics Covered:</div>
                <div className="flex flex-wrap gap-1">
                  {latestEvaluation.phase_tracking.topics_covered.map((topic, i) => (
                    <span 
                      key={i} 
                      className="bg-gray-100 px-2 py-1 rounded text-sm"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Notes:</div>
                <div className="text-sm text-gray-600">
                  <div>Pronunciation: {latestEvaluation.observations.pronunciation.notes}</div>
                  <div>Grammar: {latestEvaluation.observations.grammar.notes}</div>
                  <div>Vocabulary: {latestEvaluation.observations.vocabulary.notes}</div>
                  <div>Fluency: {latestEvaluation.observations.fluency.notes}</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Time elapsed: {latestEvaluation?.phase_tracking.time_elapsed || 0}s
          </div>
        </>
      ) : (
        <p className="text-gray-500">Session is not active...</p>
      )}
    </div>
  );
}
