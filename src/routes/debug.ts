import { Hono } from "hono";

interface DebugInfo {
  lastWebSocketMessage: string | null;
  lastEventTime: string | null;
  wsMessageCount: number;
}

interface WebSocketState {
  eventClient: any;
  isConnecting: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  VOTING_CONTRACT_ID: string;
}

export default function createDebugRoutes(
  wsState: WebSocketState,
  debugInfo: DebugInfo
) {
  const debugRoutes = new Hono();

  debugRoutes.get("/websocket-status", (c) => {
    return c.json({
      connected: !!wsState.eventClient,
      isConnecting: wsState.isConnecting,
      reconnectAttempts: wsState.reconnectAttempts,
      votingContract: wsState.VOTING_CONTRACT_ID,
      maxReconnectAttempts: wsState.maxReconnectAttempts,
    });
  });

  debugRoutes.get("/websocket-activity", (c) => {
    return c.json({
      connected: !!wsState.eventClient,
      isConnecting: wsState.isConnecting,
      reconnectAttempts: wsState.reconnectAttempts,
      votingContract: wsState.VOTING_CONTRACT_ID,
      lastMessage: debugInfo.lastWebSocketMessage,
      lastEventTime: debugInfo.lastEventTime,
      messageCount: debugInfo.wsMessageCount,
    });
  });

  debugRoutes.get("/env", (c) => {
    return c.json({
      nodeEnv: process.env.NODE_ENV,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
      agentAccountId: process.env.AGENT_ACCOUNT_ID,
      allAnthropicKeys: Object.keys(process.env).filter((k) =>
        k.toLowerCase().includes("anthropic")
      ),
      envKeysCount: Object.keys(process.env).length,
    });
  });

  return debugRoutes;
}
