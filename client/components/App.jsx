import { useState, useRef, useEffect } from "react";
import SessionControls from "./SessionControls";
import EvaluationPanel from "./EvaluationPanel";
import EventLog from "./EventLog";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [evaluationResults, setEvaluationResults] = useState([]);
  const peerConnection = useRef(null);
  const audioRef = useRef(null);

  // Start session: fetch ephemeral token, create RTCPeerConnection, etc.
  async function startSession() {
    const res = await fetch("/token");
    const tokenJSON = await res.json();
    const ephemeralKey = tokenJSON.client_secret.value;

    const pc = new RTCPeerConnection();
    audioRef.current = document.createElement("audio");
    audioRef.current.autoplay = true;
    pc.ontrack = (ev) => {
      audioRef.current.srcObject = ev.streams[0];
    };

    // Capture microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(stream.getTracks()[0]);

    // Create data channel for JSON events
    const dc = pc.createDataChannel("evaluation-events");
    setDataChannel(dc);

    dc.addEventListener("message", (e) => {
      // Received events from the model
      const evt = JSON.parse(e.data);
      setEvents((prev) => [evt, ...prev]);
    });

    dc.addEventListener("open", () => {
      setIsSessionActive(true);
      setEvents([]);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Use Realtime API endpoint
    const realtimeUrl = "https://api.openai.com/v1/realtime";
    const postOffer = await fetch(`${realtimeUrl}?model=gpt-4o-mini-realtime-preview`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp"
      },
      body: offer.sdp,
    });
    const answerSDP = await postOffer.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSDP });

    peerConnection.current = pc;
  }

  function stopSession() {
    if (dataChannel) dataChannel.close();
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  function sendEventToModel(evt) {
    if (!dataChannel) return;
    evt.event_id = evt.event_id || crypto.randomUUID();
    dataChannel.send(JSON.stringify(evt));
    setEvents((prev) => [evt, ...prev]);
  }

  function sendUserMessage(text) {
    const msgEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }]
      }
    };
    sendEventToModel(msgEvent);
    // Trigger model to respond
    sendEventToModel({ type: "response.create" });
  }

  async function handleToolCall(event) {
    // Add logging to debug the event structure
    console.log('Checking for tool calls in event:', event);

    // Check both response.output and direct tool_calls property
    const toolCalls = (event.response?.output || event.tool_calls || []).filter(
      output => (output.type === "function_call" || output.function) && 
      (output.name === "track_language_evaluation" || output.function?.name === "track_language_evaluation")
    );
    
    console.log('Found tool calls:', toolCalls);
    
    for (const call of toolCalls) {
      try {
        const args = JSON.parse(call.arguments || call.function?.arguments || '{}');
        
        setEvaluationResults(prev => [...prev, {
          id: call.call_id || crypto.randomUUID(),
          timestamp: Date.now(),
          ...args
        }]);

        // Send acknowledgment back to the model
        sendEventToModel({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call.call_id || call.id,
            output: JSON.stringify({
              received: true,
              timestamp: Date.now()
            })
          }
        });
      } catch (error) {
        console.error('Error processing tool call:', error);
      }
    }
  }

  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      const event = JSON.parse(e.data);
      setEvents(prev => [event, ...prev]);
      
      // Check multiple event types that might contain tool calls
      if (event.type === "response.done" || 
          event.type === "response.output_item.done" ||
          event.type === "function_call") {
        handleToolCall(event);
      }
    };

    dataChannel.addEventListener("message", handleMessage);
    return () => dataChannel.removeEventListener("message", handleMessage);
  }, [dataChannel]);

  return (
    <div className="w-full h-full">
      <div className="flex w-full h-full">
        <div className="flex flex-col flex-1 border-r border-gray-200">
          <div className="flex-0 h-16 border-b border-gray-200 p-4 flex items-center">
            <h1 className="text-xl">Language Evaluation</h1>
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
        <div className="w-96">
          <EvaluationPanel
            isSessionActive={isSessionActive}
            sendEventToModel={sendEventToModel}
            events={events}
            evaluationResults={evaluationResults}
          />
        </div>
      </div>
    </div>
  );
}
