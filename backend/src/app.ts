import express from "express";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { ErrorCode, errorBody } from "./shared/errors.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json(errorBody(ErrorCode.NOT_FOUND, "Route not found"));
});

app.use(errorMiddleware);
