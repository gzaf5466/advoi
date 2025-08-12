import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Peer from "peerjs";

const fakeLawyer = {
  id: "lawyer1",
  name: "Adv. Priya Sharma",
  type: "temporary",
};

const initialMessages = [
  { sender: "lawyer", text: "Hello, how can I assist you today?" },
  { sender: "client", text: "I need help with a property dispute." },
];

function ChatWindow({ roomId: propRoomId, headerTitle, onMessageReceived }) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [peerId, setPeerId] = useState("");
  const [socket, setSocket] = useState(null);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimer = useRef(null);
  const query = useQuery();
  const roomId = propRoomId || query.get("room") || "advocate-ai"; // default room
  const apiBase = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

  // Load message history when room changes
  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const res = await fetch(`${apiBase}/messages?roomId=${encodeURIComponent(roomId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const mapped = (data.messages || []).map((m) => ({
          sender: m.userId ? (m.userId === "self" ? "client" : "lawyer") : "lawyer",
          text: m.text,
          ts: m.timestamp,
        }));
        setMessages(mapped);
      } catch (e) {
        console.warn("Failed to load history", e);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, [roomId, apiBase]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const s = io(apiBase, { auth: { token } });
    setSocket(s);
    s.on("connect", () => {
      console.log("Connected to socket.io server");
      s.emit("join_room", roomId);
    });
    s.on("receive_message", (data) => {
      // data: { roomId, text, userId, timestamp, meta? }
      setMessages((prev) => [
        ...prev,
        { sender: "lawyer", text: data.text, meta: data.meta, ts: data.timestamp }
      ]);
      if (typeof onMessageReceived === "function") {
        onMessageReceived({ roomId: data.roomId || roomId, text: data.text, from: data.userId });
      }
    });
    s.on("typing", () => {
      setIsPeerTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsPeerTyping(false), 1500);
    });
    s.on("stop_typing", () => {
      setIsPeerTyping(false);
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    });
    return () => s.disconnect();
  }, [roomId, apiBase, onMessageReceived]);

  // Emit typing with debounce
  const emitTyping = useCallback(() => {
    if (!socket) return;
    socket.emit("typing", { roomId });
  }, [socket, roomId]);

  const emitStopTyping = useCallback(() => {
    if (!socket) return;
    socket.emit("stop_typing", { roomId });
  }, [socket, roomId]);

  const handleSend = () => {
    if (input.trim() === "") return;
    const outgoing = { sender: "client", text: input };
    setMessages((prev) => [...prev, outgoing]);
    // Emit to room
    if (socket) {
      socket.emit("send_message", { roomId, text: input });
    }
    setInput("");
    emitStopTyping();
  };

  // PeerJS setup
  useEffect(() => {
    const newPeer = new Peer();
    newPeer.on("open", (id) => {
      setPeerId(id);
      console.log("Generated Peer ID:", id);
    });
    return () => newPeer.destroy();
  }, []);

  return (
    <div className="w-full bg-white text-black rounded-xl shadow-md px-4 py-6 flex flex-col min-h-[500px] sm:min-h-[600px]">
      {/* Title */}
      <div className="text-lg sm:text-xl font-semibold mb-4 text-center">
        💬 Chat with {fakeLawyer.name}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border rounded-md p-3 mb-3 bg-gray-100 max-h-[300px] sm:max-h-[400px]">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 flex ${
              msg.sender === "client" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm sm:text-base ${
                msg.sender === "client"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-300 text-black"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Typing Indicator */}
      {isPeerTyping && (
        <div className="mt-2 text-xs text-gray-500">Someone is typing...</div>
      )}

      {/* Input */}
      <div className="flex flex-col sm:flex-row mt-2 gap-2">
        <input
          type="text"
          className="flex-grow bg-gray-200 text-black px-4 py-2 rounded-md border border-gray-400 focus:outline-purple-600 text-sm sm:text-base"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            emitTyping();
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => emitStopTyping(), 1200);
          }}
          onBlur={emitStopTyping}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          className="bg-purple-600 text-white px-5 py-2 rounded-md hover:bg-purple-800 transition text-sm sm:text-base"
        >
          Send
        </button>
      </div>

      {/* Video Call Info */}
      {peerId && (
        <div className="mt-5 p-4 bg-purple-100 text-purple-900 rounded-lg shadow-inner text-sm sm:text-base">
          <p className="mb-2 font-medium">📡 Your Video Call ID:</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <code className="bg-white px-3 py-1 rounded font-mono border break-all">
              {peerId}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(peerId)}
              className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-800 text-sm"
            >
              Copy ID
            </button>
          </div>

          <p className="text-gray-600 mt-2">OR share this direct link:</p>
          <a
            href={`http://localhost:5173/video-call?with=${peerId}`}
            className="text-blue-700 underline break-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            {`http://localhost:5173/video-call?with=${peerId}`}
          </a>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
