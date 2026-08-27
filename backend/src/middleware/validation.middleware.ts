import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

export interface ValidatedData {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export interface ValidatedRequest extends Request {
  validated: ValidatedData;
}

type ValidationSource = "body" | "query" | "params";

type ValidationSchemas = Partial<Record<ValidationSource, ZodType>>;

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const validated: ValidatedData = {};

    for (const source of ["body", "query", "params"] as const) {
      const schema = schemas[source];

      if (!schema) {
        continue;
      }

      const result = schema.safeParse(req[source]);

      if (!result.success) {
        next(result.error);
        return;
      }

      validated[source] = result.data;
    }

    (req as ValidatedRequest).validated = validated;
    next();
  };
}
