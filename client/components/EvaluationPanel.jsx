import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Check, X } from "lucide-react";

// Score indicator component
const ScoreIndicator = ({ score, max = 20, label }) => {
  // Ensure score stays within bounds
  const validScore = Math.max(0, Math.min(score, max));
  const percentage = (validScore / max) * 100;
  const getColor = (pct) => {
    if (pct >= 80) return "bg-green-500";
    if (pct >= 60) return "bg-yellow-500";
    if (pct >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono">{validScore}/{max}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`${getColor(percentage)} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Collapsible section component
const Section = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="mb-4 bg-white rounded-lg shadow">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex justify-between items-center border-b border-gray-100"
      >
        <h3 className="font-semibold text-gray-700">{title}</h3>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
};

// List with icons component
const IconList = ({ items, type = "check" }) => {
  const Icon = type === "check" ? Check : AlertCircle;
  const iconColor = type === "check" ? "text-green-500" : "text-red-500";
  
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          <Icon className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
          <span className="text-sm text-gray-600">{item}</span>
        </li>
      ))}
    </ul>
  );
};

// CEFR Level Badge component
const CEFRBadge = ({ level }) => {
  const getColor = (cefr) => {
    const colors = {
      'C2': 'bg-purple-100 text-purple-800',
      'C1': 'bg-blue-100 text-blue-800',
      'B2': 'bg-green-100 text-green-800',
      'B1': 'bg-yellow-100 text-yellow-800',
      'A2': 'bg-orange-100 text-orange-800',
      'A1': 'bg-red-100 text-red-800',
      'Below A1': 'bg-gray-100 text-gray-800'
    };
    return colors[cefr] || 'bg-gray-100 text-gray-800';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getColor(level)}`}>
      {level}
    </span>
  );
};

export default function EvaluationPanel({
  isSessionActive,
  evaluationResults,
  languageChoice,
}) {
  const [instructionsSent, setInstructionsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSessionActive && instructionsSent) {
      setIsLoading(true);
    } else if (evaluationResults) {
      setIsLoading(false);
    }
  }, [isSessionActive, instructionsSent, evaluationResults]);

  useEffect(() => {
    if (!isSessionActive) {
      setInstructionsSent(false);
      return;
    }
    setInstructionsSent(true);
  }, [isSessionActive]);

  // Add score validation helper
  const validateScore = (score, max) => Math.max(0, Math.min(score, max));

  if (isSessionActive && !instructionsSent) {
    return (
      <div className="h-full p-4 bg-gray-50">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!isSessionActive && !evaluationResults && !isLoading) {
    return (
      <div className="h-full p-4 bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <h3 className="font-semibold mb-2">No Active Session</h3>
          <p className="text-sm">Start a session to begin the evaluation</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full p-4 bg-gray-50">
        <div className="bg-white rounded-lg p-6 shadow">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-500">
            Generating comprehensive evaluation...
          </div>
        </div>
      </div>
    );
  }

  if (!evaluationResults) return null;

  // Process and validate the evaluation results
  const processedResults = {
    skills: {
      pronunciation: { score: validateScore(evaluationResults.skills?.pronunciation?.score || 0, 20) },
      grammar: { score: validateScore(evaluationResults.skills?.grammar?.score || 0, 20) },
      vocabulary: { score: validateScore(evaluationResults.skills?.vocabulary?.score || 0, 20) },
      fluency: { score: validateScore(evaluationResults.skills?.fluency?.score || 0, 20) },
      listening_comprehension: { score: validateScore(evaluationResults.skills?.listening_comprehension?.score || 0, 20) }
    },
    conversation_depth: {
      ...evaluationResults.conversation_depth,
      complexity_achieved: validateScore(evaluationResults.conversation_depth?.complexity_achieved || 0, 5)
    },
    quantitative_measures: {
      ...evaluationResults.quantitative_measures,
      vocabulary_range: validateScore(evaluationResults.quantitative_measures?.vocabulary_range || 0, 100)
    },
    final_scores: {
      ...evaluationResults.final_scores,
      overall_score: validateScore(evaluationResults.final_scores?.overall_score || 0, 100)
    },
    critical_feedback: evaluationResults.critical_feedback || {
      major_weaknesses: [],
      required_improvements: [],
      study_recommendations: []
    }
  };

  const {
    conversation_depth,
    skills,
    quantitative_measures,
    final_scores,
    critical_feedback
  } = processedResults;

  return (
    <div className="h-full p-4 bg-gray-50 overflow-y-auto">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Language Evaluation</h2>
        <div className="flex justify-center items-center gap-3">
          <CEFRBadge level={final_scores.cefr_level} />
          <span className="text-2xl font-bold text-gray-700">
            {final_scores.overall_score}/100
          </span>
        </div>
      </div>

      <Section title="Skill Assessment" defaultOpen={true}>
        <div className="space-y-4">
          <ScoreIndicator score={skills.pronunciation.score} label="Pronunciation" />
          <ScoreIndicator score={skills.grammar.score} label="Grammar" />
          <ScoreIndicator score={skills.vocabulary.score} label="Vocabulary" />
          <ScoreIndicator score={skills.fluency.score} label="Fluency" />
          <ScoreIndicator score={skills.listening_comprehension.score} label="Listening" />
        </div>
      </Section>

      <Section title="Conversation Analysis">
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Complexity Level</span>
            <span className="font-mono text-sm">{conversation_depth.complexity_achieved}/5</span>
          </div>
          <div className="text-sm">
            <strong>Topics Covered:</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {conversation_depth.topics_discussed.map((topic, i) => (
                <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Performance Metrics">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-gray-700">
              {Math.round(quantitative_measures.response_rate)}%
            </div>
            <div className="text-xs text-gray-500">Response Rate</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-gray-700">
              {Math.round(quantitative_measures.grammar_accuracy)}%
            </div>
            <div className="text-xs text-gray-500">Grammar Accuracy</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-gray-700">
              {Math.round(quantitative_measures.average_response_length)}
            </div>
            <div className="text-xs text-gray-500">Avg Response Length</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold text-gray-700">
              {quantitative_measures.vocabulary_range}
            </div>
            <div className="text-xs text-gray-500">Vocabulary Range</div>
          </div>
        </div>
      </Section>

      <Section title="Critical Feedback">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-red-600 mb-2">Major Weaknesses</h4>
            <IconList items={critical_feedback.major_weaknesses} type="alert" />
          </div>
          <div>
            <h4 className="font-medium text-blue-600 mb-2">Required Improvements</h4>
            <IconList items={critical_feedback.required_improvements} type="alert" />
          </div>
          <div>
            <h4 className="font-medium text-green-600 mb-2">Study Recommendations</h4>
            <IconList items={critical_feedback.study_recommendations} type="check" />
          </div>
        </div>
      </Section>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Recommended Level: {final_scores.recommended_level}</p>
      </div>
    </div>
  );
}