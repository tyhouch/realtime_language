import { useEffect, useState } from "react";

/**
 * This panel configures a single function "final_language_evaluation"
 * that the model should call exactly once at the end of the evaluation.
 *
 * The model is instructed to guide the user through four phases:
 *   1) Introduction
 *   2) Basics
 *   3) Practice grammar
 *   4) Wrap-up
 * Once completed, the model calls final_language_evaluation with a summary,
 * a final rating (1-10), and coverage booleans. Then conversation can continue
 * but the function is not called again.
 */
export default function EvaluationPanel({
  isSessionActive,
  sendEventToModel,
  events,
  evaluationResults,
  languageChoice,
}) {
  const [toolRegistered, setToolRegistered] = useState(false);

  // Single function with required parameters for the final evaluation
  const evaluationTool = {
    type: "session.update",
    session: {
      tools: [
        {
          type: "function",
          name: "final_language_evaluation",
          description:
            "A function the model must call exactly once after introduction, basics, grammar practice, and wrap-up are completed. Provide an overall summary, a final rating from 1-10, and coverage booleans.",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: {
                type: "string",
                description: "Overall summary of the user's performance.",
              },
              final_rating: {
                type: "integer",
                description: "Overall rating from 1 to 10 (1=lowest, 10=highest).",
                minimum: 1,
                maximum: 10,
              },
              coverage: {
                type: "object",
                description: "Which topics were covered?",
                properties: {
                  introduction: { type: "boolean" },
                  basics: { type: "boolean" },
                  practice_grammar: { type: "boolean" },
                  wrap_up: { type: "boolean" },
                },
                required: ["introduction", "basics", "practice_grammar", "wrap_up"],
              },
            },
            required: ["summary", "final_rating", "coverage"],
          },
        },
      ],
      tool_choice: "auto",
      instructions: `
        You are a ${languageChoice} language evaluator. 
        You will have a short conversation covering exactly four areas in order:
          1) Introduction
          2) Basics
          3) Practice grammar
          4) Wrap-up
        Keep your answers concise and in ${languageChoice}, asking the user to speak more. 
        Once you've completed all four areas, call the "final_language_evaluation" function EXACTLY ONCE 
        with a summary, a final_rating (1-10), and coverage booleans. 
        After that, you may continue the conversation if the user speaks again, but DO NOT call the function again.
        First, greet the user briefly in English, then switch to ${languageChoice} for the rest of the conversation.
      `,
    },
  };

  useEffect(() => {
    if (!isSessionActive || toolRegistered) return;

    // Step 1: Register the final evaluation tool with the model
    sendEventToModel(evaluationTool);
    setToolRegistered(true);

    // Step 2: Send an initial system message so the assistant starts the conversation
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
                Hello! I will be your ${languageChoice} language evaluator today. Let's begin with introductions. 
                Remember, once you cover introduction, basics, grammar practice, and wrap-up, call the final_language_evaluation function. 
                Let's get started! 
              `,
            },
          ],
        },
      });

      // Step 3: Ask the model for the first response
      sendEventToModel({
        type: "response.create",
        response: {
          function_call: "auto",
        },
      });
    }, 500);
  }, [isSessionActive, toolRegistered, sendEventToModel, languageChoice]);

  // If session stops, reset so we can do it again
  useEffect(() => {
    if (!isSessionActive) {
      setToolRegistered(false);
    }
  }, [isSessionActive]);

  // Show the last (and presumably only) final evaluation
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
              <h3 className="text-sm font-bold mb-2">Final Evaluation</h3>
              <div className="mb-2">
                <div className="font-medium text-sm">Summary:</div>
                <div className="text-sm">{latestEvaluation.summary}</div>
              </div>
              <div className="mb-2">
                <div className="font-medium text-sm">Final Rating:</div>
                <div className="text-sm">{latestEvaluation.final_rating}/10</div>
              </div>
              <div className="mb-2">
                <div className="font-medium text-sm">Coverage:</div>
                <ul className="list-disc list-inside text-sm">
                  <li>Introduction: {latestEvaluation.coverage.introduction ? "Yes" : "No"}</li>
                  <li>Basics: {latestEvaluation.coverage.basics ? "Yes" : "No"}</li>
                  <li>Grammar Practice: {latestEvaluation.coverage.practice_grammar ? "Yes" : "No"}</li>
                  <li>Wrap-up: {latestEvaluation.coverage.wrap_up ? "Yes" : "No"}</li>
                </ul>
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
