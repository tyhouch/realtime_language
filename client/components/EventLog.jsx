// EventLog.jsx

import { useState, useEffect } from "react";

function SingleEvent({ event }) {
  const [expanded, setExpanded] = useState(false);

  // A simple heuristic: if there's an "event_id" that doesn't start with "event_", we label it as "client ->"
  const isClient = event.event_id && !event.event_id.startsWith("event_");

  // Extract text content from different event types
  const getDisplayText = () => {
    if (event.type === "conversation.item.create" && event.item?.content) {
      // For user input
      return event.item.content.map(c => c.text).join(" ");
    } else if (event.type === "response.text.delta") {
      // For assistant responses
      return event.delta;
    }
    return event.type;
  };

  return (
    <div className="p-2 bg-gray-50 my-1 rounded">
      <div
        className="flex items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-bold mr-2">
          {isClient ? "client ->" : "assistant ->"}
        </span>
        <span className="text-xs">{getDisplayText()}</span>
      </div>
      {expanded && (
        <div className="bg-gray-200 mt-1 p-1 rounded">
          <pre className="text-xs">{JSON.stringify(event, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ConversationTimer({ startTime, isSessionActive }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !isSessionActive) return;
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isSessionActive]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-center py-4">
      <div className="text-2xl font-bold">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <p className="text-sm text-gray-600 mt-2">
        We recommend conversations over 2 minutes to properly evaluate your language skills
      </p>
    </div>
  );
}

export default function EventLog({ events, startTime, isSessionActive }) {
  const [debugMode, setDebugMode] = useState(false);

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="mr-2"
          />
          Debug Mode
        </label>
      </div>

      {!debugMode ? (
        <ConversationTimer startTime={startTime} isSessionActive={isSessionActive} />
      ) : (
        events.length === 0 ? (
          <div className="text-gray-500">No events yet...</div>
        ) : (
          events.map((ev, i) => (
            <SingleEvent key={`${ev.event_id}_${i}`} event={ev} />
          ))
        )
      )}
    </div>
  );
}
