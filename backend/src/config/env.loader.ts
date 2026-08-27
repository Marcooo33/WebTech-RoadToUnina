import "dotenv/config";
import { parseEnv } from "./env.js";

export const env = parseEnv(process.env);
