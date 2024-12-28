import { useState } from "react";

export default function SessionControls({ isSessionActive, startSession, stopSession, sendUserMessage }) {
  const [draft, setDraft] = useState("");

  if (!isSessionActive) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={startSession}
        >
          Start Evaluation
        </button>
      </div>
    );
  }

  function handleSend() {
    if (!draft.trim()) return;
    sendUserMessage(draft.trim());
    setDraft("");
  }

  return (
    <div className="w-full h-full flex items-center gap-2">
      <input
        className="flex-1 border border-gray-300 px-2 py-1 rounded"
        placeholder="Type your message..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend();
        }}
      />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleSend}
      >
        Send
      </button>
      <button
        className="px-4 py-2 bg-red-600 text-white rounded"
        onClick={stopSession}
      >
        End
      </button>
    </div>
  );
}
