import { useState, useRef, useEffect } from "react";
import SessionControls from "./SessionControls";
import EvaluationPanel from "./EvaluationPanel";
import EventLog from "./EventLog";

/**
 * Main app entry point. Manages:
 * - WebRTC handshake
 * - DataChannel for message exchange
 * - Storing all conversation events
 * - Handling tool calls
 */
export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState([]);

  const [sessionConfig, setSessionConfig] = useState({
    language: "Chinese",
    durationMinutes: 5,
  });

  const peerConnection = useRef(null);
  const audioRef = useRef(null);

  /**
   * Start a Realtime session, fetch ephemeral token, set up WebRTC + dataChannel
   */
  async function startSession() {
    const res = await fetch("/token");
    const tokenJSON = await res.json();

    const ephemeralKey = tokenJSON.client_secret.value;
    const pc = new RTCPeerConnection();

    // Setup audio
    audioRef.current = document.createElement("audio");
    audioRef.current.autoplay = true;
    pc.ontrack = (ev) => {
      audioRef.current.srcObject = ev.streams[0];
    };

    // Capture user mic
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(stream.getTracks()[0]);

    // Data channel for JSON events
    const dc = pc.createDataChannel("evaluation-events");
    setDataChannel(dc);

    dc.addEventListener("open", () => {
      setIsSessionActive(true);
      setEvents([]);
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
   */
  function stopSession() {
    if (dataChannel) dataChannel.close();
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  /**
   * Sends any event object to the model via dataChannel
   */
  function sendEventToModel(evt) {
    if (!dataChannel) return;
    evt.event_id = evt.event_id || crypto.randomUUID();
    dataChannel.send(JSON.stringify(evt));
    setEvents((prev) => [evt, ...prev]);
  }

  /**
   * When user types a message, we add that as a user turn
   * then ask the model to respond with function_call=auto
   */
  function sendUserMessage(text) {
    if (!isSessionActive) return;

    // 1) Add user message
    sendEventToModel({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });

    // 2) Prompt model to respond (with function calling)
    sendEventToModel({
      type: "response.create",
      response: {
        function_call: "auto",
      },
    });
  }

  /**
   * Whenever the model calls our tool, parse the JSON
   * and store it in evaluationResults
   */
  async function handleToolCall(event) {
    const possibleCalls = (event.response?.output || event.tool_calls || []).filter(
      (o) =>
        (o.type === "function_call" || o.function) &&
        (o.name === "track_language_evaluation" ||
          o.function?.name === "track_language_evaluation")
    );

    for (const call of possibleCalls) {
      try {
        const args = JSON.parse(call.arguments || call.function?.arguments || "{}");
        // Save results
        setEvaluationResults((prev) => [
          ...prev,
          {
            id: call.call_id || crypto.randomUUID(),
            timestamp: Date.now(),
            ...args,
          },
        ]);

        // Acknowledge function call
        sendEventToModel({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call.call_id || call.id,
            output: JSON.stringify({
              success: true,
              timestamp: Date.now(),
            }),
          },
        });
      } catch (err) {
        console.error("Error parsing function call:", err);
        // If we parse fails, we skip storing
      }
    }
  }

  /**
   * Listen for messages that might contain a function call
   */
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      const event = JSON.parse(e.data);
      setEvents((prev) => [event, ...prev]);

      if (
        event.type === "response.done" ||
        event.type === "response.output_item.done" ||
        event.type === "function_call"
      ) {
        handleToolCall(event);
      }
    };

    dataChannel.addEventListener("message", handleMessage);
    return () => dataChannel.removeEventListener("message", handleMessage);
  }, [dataChannel]);

  return (
    <div className="w-full h-full">
      <div className="flex w-full h-full">
        {/* Left Column */}
        <div className="flex flex-col flex-1 border-r border-gray-200">
          <div className="flex-0 h-16 border-b border-gray-200 p-4 flex items-center justify-between">
            <h1 className="text-xl">Language Evaluation</h1>
            {!isSessionActive && (
              <div className="flex gap-4">
                <select
                  value={sessionConfig.language}
                  onChange={(e) =>
                    setSessionConfig((prev) => ({
                      ...prev,
                      language: e.target.value,
                    }))
                  }
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  <option value="Chinese">Chinese</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="Japanese">Japanese</option>
                </select>
                <select
                  value={sessionConfig.durationMinutes}
                  onChange={(e) =>
                    setSessionConfig((prev) => ({
                      ...prev,
                      durationMinutes: parseInt(e.target.value, 10),
                    }))
                  }
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  <option value="3">3 minutes</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
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
            sendEventToModel={sendEventToModel}
            events={events}
            evaluationResults={evaluationResults}
            sessionConfig={sessionConfig}
          />
        </div>
      </div>
    </div>
  );
}
