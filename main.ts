import { Application, Router, Context, send } from "https://deno.land/x/oak@v17.1.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

import "./src/classes/extensions.ts";

import authRouter from "./src/routes/auth.ts";
import favouritesRouter from "./src/routes/favourites.ts";
import historyRouter from "./src/routes/history.ts";
import apiRouter from "./src/routes/api.ts";
import proxyRouter from "./src/routes/proxy.ts";
import { FavouritesUpdateChecker } from "./src/services/favourites_update_checker.ts";

const app = new Application();
const router = new Router();

router.get("/ping", (context) => {
  context.response.body = "Hello, world!";
});

// Use the oakCors middleware
app.use(
  oakCors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow specific methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);

app.use(router.routes(), router.allowedMethods());
app.use(authRouter.routes(), authRouter.allowedMethods());
app.use(apiRouter.routes(), apiRouter.allowedMethods());
app.use(proxyRouter.routes(), proxyRouter.allowedMethods());
app.use(favouritesRouter.routes(), favouritesRouter.allowedMethods());
app.use(historyRouter.routes(), historyRouter.allowedMethods());
const checker = new FavouritesUpdateChecker(12 * 60 * 60 * 1000); // 12 Hours
checker.start();

const port = 8000;
console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
