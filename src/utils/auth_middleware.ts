import { Context } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { SECRET_KEY } from "./secret_key.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Middleware to check for authorization

export async function decodeAndVerifyToken(token: string): Promise<any> {
  try {
    const payload = await verify(token, SECRET_KEY);
    console.log("Decoded payload:", payload);
    return payload;
  } catch (error) {
    console.error("Failed to verify token:", error);
    throw error;
  }
}

export default async function authMiddleware(context: Context, next: () => Promise<unknown>) {
  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  const user = await (async () => {
    try {
      return await decodeAndVerifyToken(token);
    } catch (e) {
      console.error("Failed to decode token:", e);
      return null;
    }
  })();

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  context.state.user = user;
  await next();
}
