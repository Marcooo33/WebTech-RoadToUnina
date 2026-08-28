import cookieParser from "cookie-parser";
import express from "express";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { ErrorCode, errorBody } from "./shared/errors.js";

export const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);

app.use((_req, res) => {
  res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
});

app.use(errorMiddleware);
