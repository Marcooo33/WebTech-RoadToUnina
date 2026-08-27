import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { z } from "zod";
import { validate, type ValidatedRequest } from "./validation.middleware.js";

function makeRequest(overrides?: {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}): Request {
  const req = {
    body: overrides?.body ?? {},
    params: overrides?.params ?? {},
  } as Record<string, unknown>;

  // Express 5 exposes req.query through a getter with no setter.
  Object.defineProperty(req, "query", {
    get: () => overrides?.query ?? {},
    enumerable: true,
    configurable: true,
  });

  return req as unknown as Request;
}

test("stores parsed body in req.validated without replacing req.body", () => {
  const middleware = validate({
    body: z.object({ count: z.coerce.number() }),
  });
  const req = makeRequest({ body: { count: "5" } });

  let nextCalled = false;
  middleware(req, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual((req as ValidatedRequest).validated.body, { count: 5 });
  assert.deepEqual((req.body as { count: string }).count, "5");
});

test("stores parsed query in req.validated without mutating req.query", () => {
  const middleware = validate({
    query: z.object({ page: z.coerce.number() }),
  });
  const req = makeRequest({ query: { page: "2" } });

  let nextCalled = false;
  middleware(req, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual((req as ValidatedRequest).validated.query, { page: 2 });
  assert.equal((req.query as { page: string }).page, "2");
});

test("stores parsed params in req.validated", () => {
  const middleware = validate({
    params: z.object({ id: z.string().uuid() }),
  });
  const req = makeRequest({
    params: { id: "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f" },
  });

  let nextCalled = false;
  middleware(req, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual((req as ValidatedRequest).validated.params, {
    id: "2b2c1f8e-6a6a-4b2b-9f1e-1a2b3c4d5e6f",
  });
});

test("stores body, query and params together", () => {
  const middleware = validate({
    body: z.object({ name: z.string() }),
    query: z.object({ page: z.coerce.number() }),
    params: z.object({ id: z.string() }),
  });
  const req = makeRequest({
    body: { name: "roadtounina" },
    query: { page: "3" },
    params: { id: "abc" },
  });

  let nextCalled = false;
  middleware(req, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual((req as ValidatedRequest).validated, {
    body: { name: "roadtounina" },
    query: { page: 3 },
    params: { id: "abc" },
  });
});

test("forwards a ZodError when validation fails", () => {
  const middleware = validate({ body: z.object({ name: z.string() }) });
  const req = makeRequest({ body: {} });

  let forwarded: unknown;
  middleware(req, {} as never, (error: unknown) => {
    forwarded = error;
  });

  assert.ok(forwarded instanceof z.ZodError);
  assert.equal((req as ValidatedRequest).validated, undefined);
});
