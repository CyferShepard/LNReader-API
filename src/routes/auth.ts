import { Router } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";
import { User } from "../schemas/users.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { SECRET_KEY } from "../utils/secret_key.ts";
import authMiddleware from "../utils/auth_middleware.ts";
import { allowRegistration } from "../utils/config.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const authRouter = new Router({ prefix: "/auth" });

//METHODS

async function generateToken(user: User): Promise<string> {
  // Remove password from user object before creating token
  (user as any).password = undefined;
  const payload = {
    username: user.username,
    user: user,
    exp: getNumericDate(60 * 60), // Token expires in 1 hour
  };

  const token = await create({ alg: "HS256", typ: "JWT" }, payload, SECRET_KEY);
  // console.log(await decodeAndVerifyToken(token));
  return token;
}

///

authRouter.post("/login", async (context) => {
  const { username, password } = await context.request.body.json();

  if (!username || !password || username.trim() === "" || password.trim() === "") {
    context.response.status = 400;
    context.response.body = { error: "Username and password are required" };
    return;
  }

  const user = await dbSqLiteHandler.getUser(username);

  if (!user) {
    context.response.status = 401;
    context.response.body = { error: "User not found" };
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user!.password as string);

  if (!isPasswordValid) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized" };
    return;
  }

  const token = await generateToken(user!);
  // await dbSqLiteHandler.insertToken(token, user);
  context.response.body = { token };
});

authRouter.post("/update", authMiddleware, async (context) => {
  const { password } = await context.request.body.json();
  const username = context.state.user.username;

  if (!password || password.trim() === "") {
    context.response.status = 400;
    context.response.body = { error: "New Password is required" };
    return;
  }

  const hash = await bcrypt.hash(password);

  await dbSqLiteHandler
    .updateUserPassword(username, hash)
    .then(async () => {
      const user = await dbSqLiteHandler.getUser(username);
      const token = await generateToken(user!);
      context.response.body = { token };
    })
    .catch((error) => {
      console.error("Error updating password:", error);
      context.response.status = 500;
      context.response.body = { error: "Failed to update password" };
    });
});

authRouter.post("/register", async (context) => {
  const { username, password } = await context.request.body.json();

  if (!username || !password) {
    context.response.status = 400;
    context.response.body = { error: "Username and password are required" };
    return;
  }

  if (allowRegistration === false) {
    context.response.status = 403;
    context.response.body = { error: "Registration is not allowed" };
    return;
  }

  const existingUser = await dbSqLiteHandler.getUser(username);
  if (existingUser) {
    context.response.status = 409;
    context.response.body = { error: "Username already exists" };
    return;
  }

  const hash = await bcrypt.hash(password);

  const newUser = new User(username, hash);
  await dbSqLiteHandler.insertUser(newUser);

  const token = await generateToken(newUser);
  // await dbSqLiteHandler.insertToken(token, newUser);
  context.response.body = { token };
});

export default authRouter;
