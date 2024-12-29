// App.jsx

import { useState, useRef, useEffect } from "react";
import SessionControls from "./SessionControls";
import EvaluationPanel from "./EvaluationPanel";
import EventLog from "./EventLog";

/**
 * Main app entry point. Manages:
 * - WebRTC handshake
 * - DataChannel for message exchange
 * - Storing conversation events
 * - Handling final structured evaluation
 */
export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [languageChoice, setLanguageChoice] = useState("Chinese");
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const peerConnection = useRef(null);
  const audioRef = useRef(null);

  /**
   * Start a Realtime session (WebRTC, ephemeral token, DataChannel)
   */
  async function startSession() {
    // Clear any prior final evaluation
    setEvaluationResults(null);
    setSessionStartTime(Date.now());

    const res = await fetch(`/token?language=${encodeURIComponent(languageChoice)}`);
    const tokenJSON = await res.json();

    const ephemeralKey = tokenJSON.client_secret.value;
    const pc = new RTCPeerConnection();

    // Setup audio
    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    document.body.appendChild(audioElement);
    audioRef.current = audioElement;
    
    pc.ontrack = (ev) => {
      if (ev.streams && ev.streams[0]) {
        audioRef.current.srcObject = ev.streams[0];
        console.log("Audio track received:", ev.streams[0].getAudioTracks());
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    };

    // Capture user mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(stream.getTracks()[0]);

    // Data channel for JSON events
    const dc = pc.createDataChannel("evaluation-events");
    setDataChannel(dc);

    // When data channel is open, we have a "live" session
    dc.addEventListener("open", () => {
      setIsSessionActive(true);
      setEvents([]);

      // Trigger the model to start speaking immediately
      sendEventToModel({
        type: "response.create",
        response: {
          modalities: ["text", "audio"]
        }
      });
    });

    dc.addEventListener("message", (e) => {
      const evt = JSON.parse(e.data);
      setEvents((prev) => [evt, ...prev]);
    });

    // WebRTC handshake
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const realtimeUrl = "https://api.openai.com/v1/realtime";
    const postOffer = await fetch(
      `${realtimeUrl}?model=gpt-4o-mini-realtime-preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      }
    );
    const answerSDP = await postOffer.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    peerConnection.current = pc;
  }

  /**
   * End the session
   * Then call finalEvaluation with full conversation
   */
  async function stopSession() {
    // 1) Close data channel + peer
    if (dataChannel) dataChannel.close();
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;

    // 2) Build entire text conversation from events
    const textConversation = buildTextConversation(events);

    // 3) Call finalEvaluation route with proper error handling
    try {
      const finalResp = await fetch("/finalEvaluation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          conversation: textConversation,
          duration: Date.now() - sessionStartTime
        }),
      });
      const data = await finalResp.json();

      if (data.success) {
        setEvaluationResults(data.evaluation);
      } else {
        setEvaluationResults({
          skills: {
            pronunciation: { score: 0 },
            grammar: { score: 0 },
            vocabulary: { score: 0 },
            fluency: { score: 0 },
            listening_comprehension: { score: 0 }
          },
          conversation_depth: {
            topics_discussed: [],
            complexity_achieved: 0,
            substantive_discussion: false,
            longest_response_quality: 0
          },
          quantitative_measures: {
            response_rate: 0,
            average_response_length: 0,
            grammar_accuracy: 0,
            vocabulary_range: 0
          },
          final_scores: {
            overall_score: 0,
            cefr_level: 'Below A1',
            recommended_level: 'Beginner'
          },
          critical_feedback: {
            major_weaknesses: ['Unable to complete evaluation'],
            required_improvements: [],
            study_recommendations: []
          }
        });
      }
    } catch (error) {
      console.error('Evaluation error:', error);
      // Set error state with proper structure
      setEvaluationResults({
        skills: {
          pronunciation: { score: 0 },
          grammar: { score: 0 },
          vocabulary: { score: 0 },
          fluency: { score: 0 },
          listening_comprehension: { score: 0 }
        },
        conversation_depth: {
          topics_discussed: [],
          complexity_achieved: 0,
          substantive_discussion: false,
          longest_response_quality: 0
        },
        quantitative_measures: {
          response_rate: 0,
          average_response_length: 0,
          grammar_accuracy: 0,
          vocabulary_range: 0
        },
        final_scores: {
          overall_score: 0,
          cefr_level: 'Below A1',
          recommended_level: 'Beginner'
        },
        critical_feedback: {
          major_weaknesses: ['Unable to complete evaluation'],
          required_improvements: [],
          study_recommendations: []
        }
      });
    }
  }

  /**
   * Helper: gather user & assistant text from events
   */
  function buildTextConversation(allEvents) {
    const textOnly = [];
    for (let i = allEvents.length - 1; i >= 0; i--) {
      const ev = allEvents[i];
      if (
        ev.type === "conversation.item.create" &&
        ev.item?.type === "message" &&
        ev.item?.content?.length
      ) {
        const role = ev.item.role || "assistant";
        const textContent = ev.item.content
          .map((c) => c.text || "")
          .join(" ");
        if (textContent.trim()) {
          textOnly.push({ role, text: textContent.trim() });
        }
      }
    }
    // Reverse so earliest messages come first
    return textOnly.reverse();
  }

  /**
   * Send any event object to the model over dataChannel
   */
  function sendEventToModel(evt) {
    if (!dataChannel) return;
    evt.event_id = evt.event_id || crypto.randomUUID();
    dataChannel.send(JSON.stringify(evt));
    setEvents((prev) => [evt, ...prev]);
  }

  /**
   * When user types a message, we add that as a user turn
   * then ask the model to respond
   */
  function sendUserMessage(text) {
    if (!isSessionActive) return;

    // 1) Add the user's message to conversation
    sendEventToModel({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });

    // 2) Request model response with both text and audio
    sendEventToModel({
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        function_call: "auto"
      }
    });
  }

  /**
   * Monitor inbound messages from the model
   */
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      const event = JSON.parse(e.data);
      setEvents((prev) => [event, ...prev]);
    };

    dataChannel.addEventListener("message", handleMessage);
    return () => dataChannel.removeEventListener("message", handleMessage);
  }, [dataChannel]);

  useEffect(() => {
    return () => {
      // Cleanup audio element on unmount
      if (audioRef.current) {
        document.body.removeChild(audioRef.current);
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full">
      <div className="flex w-full h-full">
        {/* Left Column */}
        <div className="flex flex-col flex-1 border-r border-gray-200">
          <div className="flex-0 h-16 border-b border-gray-200 p-4 flex items-center justify-between">
            <h1 className="text-xl">Language Evaluation</h1>
            {!isSessionActive && (
              <div>
                <select
                  value={languageChoice}
                  onChange={(e) => setLanguageChoice(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  <option value="Chinese">Chinese</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Japanese">Japanese</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            <EventLog events={events} />
          </div>
          <div className="h-24 p-4 border-t border-gray-200">
            <SessionControls
              isSessionActive={isSessionActive}
              startSession={startSession}
              stopSession={stopSession}
              sendUserMessage={sendUserMessage}
            />
          </div>
        </div>

        {/* Right Column: Evaluation Panel */}
        <div className="w-96">
          <EvaluationPanel
            isSessionActive={isSessionActive}
            evaluationResults={evaluationResults}
            languageChoice={languageChoice}
          />
        </div>
      </div>
    </div>
  );
}
