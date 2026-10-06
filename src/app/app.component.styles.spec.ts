import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stylesheet = readFileSync(new URL("./app.component.css", import.meta.url), "utf8");

test("as colunas acomodam dois cards com dois terços da largura anterior", () => {
  const previousCardWidth = (265 - 24 - 8) / 2;
  const expectedCardWidth = previousCardWidth * (2 / 3);
  const reducedLaneWidth = 187.333;
  const cardWidth = (reducedLaneWidth - 24 - 8) / 2;

  assert.ok(Math.abs(cardWidth - expectedCardWidth) < 0.001);
  assert.match(stylesheet, /\.flow \{[^}]*grid-auto-columns: 187\.333px;/);
  assert.match(stylesheet, /\.lane \{[^}]*min-width: 187\.333px;/);
  assert.match(stylesheet, /\.lane-content \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(stylesheet, /\.card-date-range \{[^}]*display: grid;[^}]*line-height: 1\.2;/);
});
