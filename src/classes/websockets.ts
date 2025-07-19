import { Context } from "https://deno.land/x/oak@v17.1.3/context.ts";
import { wsClients } from "../utils/config.ts";

export default function sendMessage(context: Context, message: string | Map<string, Record<string, unknown>>) {
  const username = context.state.user?.username;
  if (username && wsClients.has(username)) {
    const payload = typeof message === "string" ? message : JSON.stringify(Object.fromEntries(message));
    wsClients.get(username)!.send(payload);
  } else {
    console.error("WebSocket client not found for user:", username);
  }
}

export function broadcastMessage(message: string | Map<string, Record<string, unknown>>) {
  wsClients.forEach((ws) => {
    const payload = typeof message === "string" ? message : JSON.stringify(Object.fromEntries(message));
    ws.send(payload);
  });
}
