import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseRulerSubdivision,
  getRulerTickLength
} from "../webview/timeline-ruler.ts";

test("ruler progressively reveals subdivisions as the timeline is enlarged", () => {
  assert.equal(chooseRulerSubdivision(12), 1);
  assert.equal(chooseRulerSubdivision(24), 2);
  assert.equal(chooseRulerSubdivision(47.9), 2);
  assert.equal(chooseRulerSubdivision(48), 4);
});

test("ruler uses a clear three-level tick hierarchy", () => {
  assert.ok(getRulerTickLength("measure") > getRulerTickLength("beat"));
  assert.ok(getRulerTickLength("beat") > getRulerTickLength("subdivision"));
});
