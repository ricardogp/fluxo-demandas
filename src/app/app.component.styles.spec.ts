import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stylesheet = readFileSync(new URL("./app.component.css", import.meta.url), "utf8");
const globalStylesheet = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
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

test("o fluxo oferece abas para os formatos de tabela, grafo e grafo circular", () => {
  assert.match(template, /<button class="visualization-tab" \[class\.active\]="activeVisualization\(\) === 'table'"[^>]*\(click\)="setVisualization\('table'\)">Formato de tabela<\/button>/);
  assert.match(template, /<button class="visualization-tab" \[class\.active\]="activeVisualization\(\) === 'graph'"[^>]*\(click\)="setVisualization\('graph'\)">Formato de grafo<\/button>/);
  assert.match(template, /<button class="visualization-tab" \[class\.active\]="activeVisualization\(\) === 'circularGraph'"[^>]*\(click\)="setVisualization\('circularGraph'\)">Formato de grafo circular<\/button>/);
  assert.match(template, /<div class="visualization-panel graph-panel" id="graph-format-panel" role="tabpanel" aria-labelledby="graph-format-tab">/);
  assert.match(template, /<div class="visualization-panel graph-panel" id="circular-graph-format-panel" role="tabpanel" aria-labelledby="circular-graph-format-tab">/);
  assert.match(template, /<svg class="graph-canvas" \[attr\.viewBox\]="'0 0 1000 ' \+ graph\(\)\.height" role="img" aria-label="Fluxo das demandas por fase, distribuído em níveis">/);
  assert.match(template, /<aside class="graph-legend" aria-label="Legenda das cores dos tipos de demanda">\s*<span class="graph-legend-title">Cores das demandas<\/span>\s*@for \(demandType of demandTypeOrder\(\); track demandType\)/);
  assert.match(template, /<i class="graph-legend-dot" \[style\.background\]="demandTypeColor\(demandType\)" aria-hidden="true"><\/i>\{\{ demandType \}\}/);
  assert.match(template, /<marker id="graph-arrow" markerWidth="4\.5" markerHeight="4\.5" refX="4" refY="2\.25" orient="auto" markerUnits="userSpaceOnUse">/);
  assert.match(template, /<path class="graph-transition" \[attr\.d\]="transition\.path"[^>]*\[attr\.stroke-width\]="transition\.strokeWidth"[^>]*marker-end="url\(#graph-arrow\)">/);
  assert.match(template, /<circle class="graph-phase-node"[^>]*r="11"><\/circle>/);
  assert.match(template, /<text class="graph-phase-count" \[attr\.x\]="phase\.x" \[attr\.y\]="phase\.y" \[attr\.fill\]="phase\.countColor">\{\{ phase\.activeCount \}\}<\/text>/);
  assert.match(template, /<circle class="graph-demand"[^>]*r="3\.5" tabindex="0"[^>]*\(pointerenter\)="showDemandHint\(\$event, demand\.item\)"[^>]*\(focusin\)="showDemandHint\(\$event, demand\.item\)"[^>]*\[attr\.aria-describedby\]="'demand-hint-' \+ demand\.number"/);
  assert.match(template, /<text class="graph-phase-label" \[attr\.x\]="phase\.x" \[attr\.y\]="phase\.y \+ 22">/);
  assert.match(template, /<tspan \[attr\.x\]="phase\.x" \[attr\.dy\]="\$index === 0 \? 0 : 7">\{\{ line \}\}<\/tspan>/);
  assert.match(stylesheet, /\.visualization-tab\.active \{[^}]*border-bottom-color: #e5bb65;[^}]*color: #f1c970;/);
  assert.match(stylesheet, /\.graph-canvas {[^}]*min-height: 150px;[^}]*background: linear-gradient/);
  assert.match(template, /<title>\{\{ phase\.status \}\} · \{\{ phase\.activeCount \}\} demanda\(s\) em andamento<\/title>/);
  assert.match(stylesheet, /\.graph-phase-count { font-size: 7px; font-weight: 800; text-anchor: middle; dominant-baseline: central; \}/);
  assert.match(globalStylesheet, /\.graph-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 8px;/);
  assert.match(stylesheet, /\.graph-demand { cursor: pointer; \}/);
  assert.match(stylesheet, /\.graph-phase-node { r: 11px; fill-opacity: \.92; stroke-width: 1\.5px;/);
  assert.match(stylesheet, /\.graph-transition \{ fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-opacity: \.62; \}/);
  assert.match(template, /<svg class="graph-canvas circular-graph-canvas" \[attr\.viewBox\]="'0 0 1000 ' \+ circularGraph\(\)\.height" role="img" aria-label="Fluxo circular das demandas por fase">/);
  assert.match(template, /<circle class="circular-graph-guide" cx="500" cy="280" r="160" aria-hidden="true"><\/circle>/);
  assert.match(template, /<path class="graph-transition" \[attr\.d\]="transition\.path"[^>]*marker-end="url\(#circular-graph-arrow\)">/);
  assert.match(globalStylesheet, /\.circular-graph-guide \{ fill: none; stroke: #76809b; stroke-width: 1px;/);
});

test("os filtros exibem checkboxes em até três linhas sob demanda", () => {
  assert.match(template, /<button class="visibility-filter-trigger" type="button" \(click\)="toggleVisibilityFilter\('status'\)" \[attr\.aria-expanded\]="visibilityFilterExpanded\('status'\)"/);
  assert.match(template, /<input type="checkbox" \[checked\]="statusVisible\(status\)" \(change\)="toggleStatusVisibility\(status\)"/);
  assert.match(template, /<input type="checkbox" \[checked\]="demandVisible\(history\.number\)" \(change\)="toggleDemandVisibility\(history\.number\)"/);
  assert.match(template, /<input type="checkbox" \[checked\]="demandTypeVisible\(demandType\)" \(change\)="toggleDemandTypeVisibility\(demandType\)"/);
  assert.match(template, /<span class="visibility-option-title" \[style\.color\]="laneColor\(status\)"/);
  assert.match(template, /<span class="visibility-option-title" \[style\.color\]="demandTypeColor\(history\.demandType\)"/);
  assert.match(stylesheet, /\.visibility-filter-trigger \{[^}]*min-height: 34px;/);
  assert.match(stylesheet, /\.visibility-options \{[^}]*grid-template-rows: repeat\(3, minmax\(25px, auto\)\);[^}]*grid-auto-flow: column;[^}]*grid-auto-columns: minmax\(190px, max-content\);/);
});

test("o número do card recebe a cor do tipo da demanda", () => {
  assert.match(template, /<h3 \[style\.color\]="demandTypeColor\(item\.demandType\)">\{\{ item\.number \}\}<\/h3>/);
  assert.match(template, /<p class="hint-type"><span>Tipo de demanda<\/span><strong \[style\.color\]="demandTypeColor\(hint\.item\.demandType\)">\{\{ hint\.item\.demandType \}\}<\/strong><\/p>/);
  assert.match(stylesheet, /\.hint-title, \.hint-type \{[^}]*display: grid;/);
});

test("os cards usam sombras em camadas para criar profundidade", () => {
  assert.match(stylesheet, /:host \.demand-card \{ box-shadow: 0 3px #0004, 0 9px 18px #0004; \}/);
  assert.match(stylesheet, /:host \.light-theme \.demand-card \{ box-shadow: 0 3px #2a374f14, 0 9px 18px #2a374f1f; \}/);
});

test("a data exibida acompanha o marcador da linha do tempo", () => {
  assert.match(template, /<div class="timeline-slider">\s*<input class="timeline"[^>]*\[max\]="timelineSliderMaximum"[^>]*\[value\]="sliderInputValue\(\)"[^>]*\[attr\.aria-valuetext\]="timelineLabel\(\)"[^>]*\/>\s*<div class="selected-date" \[class\.at-start\]="sliderValue\(\) <= 1" \[class\.at-end\]="sliderValue\(\) >= 999" \[style\.left\.\%\]="sliderValue\(\) \/ 10">/);
  assert.match(stylesheet, /\.selected-date \{[^}]*position: absolute;[^}]*transform: translateX\(-50%\);/);
  assert.match(stylesheet, /\.selected-date\.at-start \{ transform: none; \}\.selected-date\.at-end \{ transform: translateX\(-100%\); \}/);
});
