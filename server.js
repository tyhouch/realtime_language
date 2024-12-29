import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

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
server.get("/token", async (request) => {
  const targetLanguage = request.query.language || 'English';
  
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview",
      voice: "verse",
      instructions: `You are a strict professional language evaluator conducting an oral proficiency interview in ${targetLanguage}.
        
        IMPORTANT: When the session begins, introduce yourself in English following this format:
        "Hello! I'm your language proficiency evaluator. We'll be conducting a rigorous assessment of your ${targetLanguage} skills through conversation. Are you ready to begin?"

        After user confirmation, switch completely to ${targetLanguage}.
        
        Your responses should be short and concise. This is a test of the user's language ability, not your ability to speak ${targetLanguage}.

        Evaluation structure:
        1. Basic competency check (greetings, simple personal info)
        2. Daily scenarios (work, study, routines)
        3. Abstract discussion (opinions, hypotheticals)
        4. Complex topics (current events, specialized fields)
        5. Brief wrap-up
        
        YOU MUST:
        - Push for detailed responses
        - Challenge the user with increasing complexity
        - Note when user avoids difficult topics
        - Track mistakes and simplifications
        - Keep your responses concise and to the point. 

        YOU CAN:
        - Use English if the user struggles
        
        
        DO NOT:
        - Skip evaluation stages
        - Give long responses`,
    }),
  });

  return new Response(response.body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * 4) Route: finalEvaluation
 */
server.post("/finalEvaluation", async (req, reply) => {
  try {
    const { conversation, duration } = req.body;
    
    // Add detailed debugging
    console.log("Received request body:", JSON.stringify(req.body, null, 2));
    console.log("Conversation array length:", conversation?.length || 0);
    if (conversation?.length > 0) {
      console.log("First conversation item:", conversation[0]);
      console.log("Last conversation item:", conversation[conversation.length - 1]);
    }
    
    if (!conversation || !conversation.length) {
      return reply
        .status(400)
        .send({ error: "Missing or empty conversation in request body" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Define detailed evaluation schema
    const SkillAssessment = z.object({
      score: z.number().int(),
      critical_issues: z.array(z.string()),
      examples: z.array(z.string())
    });

    const EvaluationSchema = z.object({
      conversation_depth: z.object({
        topics_discussed: z.array(z.string()),
        complexity_achieved: z.number().int(),
        substantive_discussion: z.boolean(),
        longest_response_quality: z.number().int()
      }),
      skills: z.object({
        pronunciation: SkillAssessment,
        grammar: SkillAssessment,
        vocabulary: SkillAssessment,
        fluency: SkillAssessment,
        listening_comprehension: SkillAssessment
      }),
      quantitative_measures: z.object({
        response_rate: z.number(),
        average_response_length: z.number(),
        grammar_accuracy: z.number(),
        vocabulary_range: z.number().int()
      }),
      final_scores: z.object({
        overall_score: z.number().int(),
        cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Below A1']),
        recommended_level: z.string()
      }),
      critical_feedback: z.object({
        major_weaknesses: z.array(z.string()),
        required_improvements: z.array(z.string()),
        study_recommendations: z.array(z.string())
      })
    });

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a strict language evaluator analyzing an oral proficiency interview.
            You must be highly critical and thorough in your assessment.
            
            EVALUATION RULES:
            - If the conversation lacks substance or depth, assign scores of 0
            - Deduct points heavily for:
              * Repeated basic mistakes
              * Avoidance of complex topics
              * Excessive pausing or hesitation
              * Limited vocabulary range
              * Poor listening comprehension
            
            - Consider conversation duration of ${duration} seconds when evaluating
            - Look for evidence of actual language ability, not just memorized phrases
            - Identify specific examples of errors and issues
            - Be especially critical of advanced level claims
            
            Your evaluation must be detailed and evidence-based. 
            Do not inflate scores or be overly encouraging.
            Focus on concrete issues and necessary improvements.`
        },
        {
          role: "user",
          content: conversation
            .map((c) => `[${c.role.toUpperCase()}]: ${c.text}`)
            .join("\n"),
        },
      ],
      response_format: zodResponseFormat(EvaluationSchema, "language_evaluation"),
    });

    const evaluation = completion.choices[0].message.parsed;
    
    // Calculate overall score based on skills and other metrics
    const calculateOverallScore = (evaluation) => {
      // Skills contribute 60% of total score (12 points each max)
      const skillsScore = Object.values(evaluation.skills).reduce((sum, skill) => {
        return sum + (skill.score * 0.6);  // Convert from /20 to /12
      }, 0);

      // Conversation depth contributes 20% (20 points max)
      const depthScore = (
        (evaluation.conversation_depth.complexity_achieved * 2) + // 0-10 points
        (evaluation.conversation_depth.substantive_discussion ? 5 : 0) + // 5 points
        (evaluation.conversation_depth.longest_response_quality * 1) // 0-5 points
      );

      // Quantitative measures contribute 20% (20 points max)
      const quantScore = (
        (evaluation.quantitative_measures.response_rate / 100 * 5) + // 0-5 points
        (evaluation.quantitative_measures.grammar_accuracy / 100 * 5) + // 0-5 points
        (evaluation.quantitative_measures.vocabulary_range / 100 * 5) + // 0-5 points
        (Math.min(evaluation.quantitative_measures.average_response_length / 50, 1) * 5) // 0-5 points
      );

      // Calculate total (max 100)
      return Math.round(skillsScore + depthScore + quantScore);
    };

    // Calculate and update the overall score
    evaluation.final_scores.overall_score = calculateOverallScore(evaluation);

    // Ensure scores align with CEFR levels
    const cefr_minimums = {
      'C2': 95,
      'C1': 85,
      'B2': 70,
      'B1': 55,
      'A2': 35,
      'A1': 15,
      'Below A1': 0
    };

    // Validate CEFR alignment
    for (const [level, min_score] of Object.entries(cefr_minimums)) {
      if (evaluation.final_scores.overall_score >= min_score) {
        evaluation.final_scores.cefr_level = level;
        break;
      }
    }

    return { success: true, evaluation };

  } catch (err) {
    console.error("Error in finalEvaluation:", err);
    reply.status(500).send({
      success: false,
      error: err.message
    });
  }
});

/**
 * 5) Start listening
 */
await server.listen({ port: process.env.PORT || 3000 });