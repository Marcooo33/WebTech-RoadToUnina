import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidMediaWikiPageId } from "./wikipedia.validation.js";

test("accepts finite positive integer page IDs", () => {
  for (const value of [1, 2, 123, 2930935, Number.MAX_SAFE_INTEGER]) {
    assert.equal(isValidMediaWikiPageId(value), true, String(value));
  }
});

test("rejects non-positive, fractional and non-finite numbers", () => {
  for (const value of [0, -1, -3, 1.5, 1.25, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(isValidMediaWikiPageId(value), false, String(value));
  }
});

test("rejects non-number and nullish values", () => {
  for (const value of ["123", "", "0", null, undefined, {}, [], true]) {
    assert.equal(isValidMediaWikiPageId(value), false, String(value));
  }
});
