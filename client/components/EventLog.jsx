import { useState } from "react";

function SingleEvent({ event }) {
  const [expanded, setExpanded] = useState(false);

  // A simple heuristic: if there's an "event_id" that doesn't start with "event_", we label it as "client ->"
  // otherwise "assistant ->". Adjust as needed.
  const isClient = event.event_id && !event.event_id.startsWith("event_");

  return (
    <div className="p-2 bg-gray-50 my-1 rounded">
      <div
        className="flex items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs font-bold mr-2">
          {isClient ? "client ->" : "assistant ->"}
        </span>
        <span className="text-xs">{event.type}</span>
      </div>
      {expanded && (
        <div className="bg-gray-200 mt-1 p-1 rounded">
          <pre className="text-xs">{JSON.stringify(event, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function EventLog({ events }) {
  return (
    <div className="p-2">
      {events.length === 0 ? (
        <div className="text-gray-500">No events yet...</div>
      ) : (
        // Use (ev, i) as fallback key, so we don’t get duplicates if event_id repeats
        events.map((ev, i) => (
          <SingleEvent key={`${ev.event_id}_${i}`} event={ev} />
        ))
      )}
    </div>
  );
}
