import { useEffect, useState } from "react";

export default function EvaluationPanel({
  isSessionActive,
  evaluationResults,
  languageChoice,
}) {
  const [instructionsSent, setInstructionsSent] = useState(false);

  /**
   * In this simplified version, we do not do any function calls
   * for final_language_evaluation in the middle of conversation.
   * Instead, that final evaluation is triggered after Stop.
   * We do instruct the assistant at session start, so it
   * converses in languageChoice.
   */
  useEffect(() => {
    if (!isSessionActive) {
      setInstructionsSent(false);
      return;
    }
    // Mark that instructions have been "sent"
    setInstructionsSent(true);
  }, [isSessionActive]);

  return (
    <div className="h-full p-4 bg-gray-100 overflow-y-auto">
      <h2 className="text-lg font-bold mb-2">Evaluation Overview</h2>
      {isSessionActive && !instructionsSent && (
        <p className="text-gray-500 text-sm">
          Starting session, instructions will be handled automatically...
        </p>
      )}
      {!isSessionActive && (
        <p className="text-gray-500 text-sm mb-3">
          Session is not active. Once you stop, we fetch a final evaluation.
        </p>
      )}

      <hr className="my-3" />

      {evaluationResults ? (
        <div className="bg-white rounded p-4">
          <h3 className="font-bold mb-2 text-sm">Final Evaluation</h3>
          <p className="text-sm mb-2">
            <strong>Overall Summary:</strong> {evaluationResults.overall_summary}
          </p>
          <p className="text-sm mb-2">
            <strong>Rating (1-10):</strong> {evaluationResults.rating}
          </p>
          <p className="text-sm mb-2">
            <strong>Strengths:</strong>{" "}
            {evaluationResults.strengths && evaluationResults.strengths.length > 0
              ? evaluationResults.strengths.join(", ")
              : "N/A"}
          </p>
          <p className="text-sm mb-2">
            <strong>Weaknesses:</strong>{" "}
            {evaluationResults.weaknesses && evaluationResults.weaknesses.length > 0
              ? evaluationResults.weaknesses.join(", ")
              : "N/A"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          No final evaluation yet. Start and then Stop the session to see one.
        </p>
      )}
    </div>
  );
}
