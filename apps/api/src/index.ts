import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./auth.js";
import { config } from "./config.js";
import { migrate, pool } from "./database.js";
import { errorHandler, notFound } from "./http.js";
import { vaultRouter } from "./vault.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "2mb", type: "application/json" }));
app.use(cookieParser());

app.use((request, response, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.get("origin");
    if (origin && origin !== config.WEB_ORIGIN) {
      response
        .status(403)
        .json({
          error: "invalid_origin",
          message: "Request origin is not allowed.",
        });
      return;
    }
  }
  next();
});

app.get("/api/v1/health/live", (_request, response) =>
  response.json({ status: "ok" }),
);
app.get("/api/v1/health/ready", async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ status: "ok" });
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/vault", vaultRouter);
app.use(notFound);
app.use(errorHandler);

await migrate();
app.listen(config.PORT, () => {
  console.log(`Amethyst API listening on port ${config.PORT}`);
});
