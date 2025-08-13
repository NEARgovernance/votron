import { useState, useEffect, useRef } from "react";

export function useWebSocket() {
  const [wsData, setWsData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${Constants.API_URL}/api/debug/websocket-activity`
        );
        if (response.ok) {
          const data = await response.json();
          setWsData(data);
          setIsConnected(true);
        }
      } catch (error) {
        setIsConnected(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return { wsData, isConnected };
}
