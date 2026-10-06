import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stylesheet = readFileSync(new URL("./app.component.css", import.meta.url), "utf8");
const template = readFileSync(new URL("./app.component.html", import.meta.url), "utf8");

test("as colunas acomodam dois cards com dois terços da largura anterior", () => {
  const previousCardWidth = (265 - 24 - 8) / 2;
  const expectedCardWidth = previousCardWidth * (2 / 3);
  const reducedLaneWidth = 187.333;
  const cardWidth = (reducedLaneWidth - 24 - 8) / 2;

  assert.ok(Math.abs(cardWidth - expectedCardWidth) < 0.001);
  assert.match(stylesheet, /\.flow \{[^}]*grid-auto-columns: 187\.333px;/);
  assert.match(stylesheet, /\.lane \{[^}]*min-width: 187\.333px;/);
  assert.match(stylesheet, /\.lane-content \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(stylesheet, /\.card-date-range \{[^}]*display: grid;[^}]*width: 6ch;[^}]*line-height: 1\.2;/);
  assert.match(stylesheet, /\.card-date-range-separator \{ justify-self: center; \}/);
});

test("o intervalo do card exibe a preposição em uma terceira linha", () => {
  assert.match(template, /<span>\{\{ cardDateLabel\(item\.event\.startedAt\) \}\}<\/span>\s*<span class="card-date-range-separator" aria-hidden="true">a<\/span>\s*<span>\{\{ cardDateLabel\(item\.event\.endedAt\) \}\}<\/span>/);
});

test("o controle de tempo compacto antecede as situações", () => {
  assert.ok(template.indexOf('<section class="time-control"') < template.indexOf('<section class="flow"'));
  assert.match(stylesheet, /\.time-control \{ margin: 0 0 12px; padding: 10px 0;/);
  assert.match(stylesheet, /\.playback-row \{[^}]*margin-top: 5px;/);
});

test("os filtros usam seletores múltiplos de situações e demandas", () => {
  assert.match(template, /<section class="visibility-controls" aria-label="Filtros de visualização">[\s\S]*<select multiple size="4" \(change\)="setVisibleStatuses\(\$event\)"/);
  assert.match(template, /<select multiple size="4" \(change\)="setVisibleDemands\(\$event\)"/);
  assert.match(stylesheet, /\.visibility-combo select \{[^}]*min-height: 82px;/);
});

test("a data exibida acompanha o marcador da linha do tempo", () => {
  assert.match(template, /<div class="timeline-slider">\s*<input class="timeline"[^>]*\[attr\.aria-valuetext\]="timelineLabel\(\)"[^>]*\/>\s*<div class="selected-date" \[class\.at-start\]="sliderValue\(\) <= 1" \[class\.at-end\]="sliderValue\(\) >= 999" \[style\.left\.\%\]="sliderValue\(\) \/ 10">/);
  assert.match(stylesheet, /\.selected-date \{[^}]*position: absolute;[^}]*transform: translateX\(-50%\);/);
  assert.match(stylesheet, /\.selected-date\.at-start \{ transform: none; \}\.selected-date\.at-end \{ transform: translateX\(-100%\); \}/);
});
