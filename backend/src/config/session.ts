import ms from "ms";
import type { StringValue } from "ms";
import { env } from "./env.loader.js";

/**
 * A play session is considered expired when the interval between "now" and its
 * last confirmed heartbeat exceeds this value. Configurable through
 * `SESSION_HEARTBEAT_TIMEOUT` (a duration string); defaults to 90 seconds.
 *
 * The frontend is expected to send a heartbeat well within this window; a
 * crashed or closed browser then stops, and the backend lazily finalizes the
 * session using the last heartbeat as the effective end.
 */
export const SESSION_HEARTBEAT_TIMEOUT_MS = ms(
  env.SESSION_HEARTBEAT_TIMEOUT as StringValue,
);
