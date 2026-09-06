"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { VideoAIChat } from "@/components/VideoAIChat";

interface LoadedSessionData {
  messages?: any[];
  promptOnlyMode?: boolean;
  customTotalDuration?: number | null;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadedData, setLoadedData] = useState<LoadedSessionData | null>(null);
  const [chatKey, setChatKey] = useState(0); // bumping this forces VideoAIChat to remount fresh
  const [refreshKey, setRefreshKey] = useState(0);

  function handleNewChat() {
    setActiveSessionId(null);
    setLoadedData(null);
    setChatKey((k) => k + 1);
    setSidebarOpen(false);
  }

  async function handleSelectSession(id: string) {
    try {
      const res = await fetch(`/api/chat-sessions/${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveSessionId(id);
        setLoadedData(data.data);
        setChatKey((k) => k + 1);
        setSidebarOpen(false);
      }
    } catch {
      /* best-effort */
    }
  }

  function handleSessionSaved(id: string) {
    setActiveSessionId(id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <ChatHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex flex-1 overflow-hidden">
        {session && (
          <ChatHistorySidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            activeSessionId={activeSessionId}
            refreshKey={refreshKey}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />
        )}
        <div className="min-w-0 flex-1">
          <VideoAIChat
            key={chatKey}
            sessionId={activeSessionId}
            initialMessages={loadedData?.messages}
            initialPromptOnlyMode={loadedData?.promptOnlyMode}
            initialCustomTotalDuration={loadedData?.customTotalDuration}
            onSessionSaved={handleSessionSaved}
          />
        </div>
      </div>
    </div>
  );
}
