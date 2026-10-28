import type { RequestHandler } from "express";
import { ApiError, ErrorCode } from "../shared/errors.js";

// No cross-origin browser API access is needed by the same-origin SPA. Native
// API clients without browser metadata remain usable; metadata is a CSRF
// defence, not authentication. Existing guest/login custom-header checks stay.
export function createRequestProtection(publicOrigin?: string): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get("Origin");
    const fetchSite = req.get("Sec-Fetch-Site");
    // The Angular development proxy rewrites Host. Compare against a fixed
    // configured origin in production, never forwarded host headers.
    if (
      (origin !== undefined &&
        (origin === "null" ||
          (publicOrigin !== undefined && origin !== publicOrigin))) ||
      fetchSite === "cross-site" ||
      fetchSite === "same-site"
    ) {
      next(
        new ApiError(
          403,
          ErrorCode.REQUEST_ORIGIN_REJECTED,
          "A same-origin application request is required.",
        ),
      );
      return;
    }
    next();
  };
}
