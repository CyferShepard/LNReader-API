import { Context } from "https://deno.land/x/oak@v17.1.3/context.ts";
import { wsClients } from "../utils/config.ts";

export default function sendMessage(context: Context, message: string) {
  const username = context.state.user?.username;
  if (username && wsClients.has(username)) {
    wsClients.get(username)!.send(JSON.stringify({ message }));
  } else {
    console.error("WebSocket client not found for user:", username);
  }
}
