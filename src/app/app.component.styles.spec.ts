import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const appTemplate = read("./app.component.html");
const appComponent = read("./app.component.ts");
const stylesheet = read("./app.component.css");
const globalStylesheet = read("../styles.css");
const filters = read("./components/visibility-filters.component.ts");
const timeline = read("./components/timeline-controls.component.ts");
const table = read("./components/table-flow.component.ts");
const graph = read("./components/flow-graph.component.ts");

test("o contêiner compõe superfícies independentes sem alterar as abas", () => {
  for (const selector of ["fd-app-header", "fd-visibility-filters", "fd-timeline-controls", "fd-table-flow", "fd-flow-graph"]) assert.match(appTemplate, new RegExp(`<${selector}`));
  assert.match(appTemplate, /role="tablist"/);
  assert.match(appTemplate, /id="table-format-tab"/);
  assert.match(appTemplate, /id="graph-format-tab"/);
  assert.match(appComponent, /encapsulation: ViewEncapsulation\.None/);
});

test("os filtros mantêm checkboxes e no máximo três linhas", () => {
  assert.match(filters, /<input type="checkbox" \[checked\]="statusVisible\(status\)"/);
  assert.match(filters, /<input type="checkbox" \[checked\]="demandVisible\(history\.number\)"/);
  assert.match(filters, /<input type="checkbox" \[checked\]="demandTypeVisible\(demandType\)"/);
  assert.match(stylesheet, /\.visibility-options \{[^}]*grid-template-rows: repeat\(3, minmax\(25px, auto\)\);[^}]*grid-auto-flow: column;/);
});

test("a tabela preserva cartões, representação numérica e painel contextual", () => {
  assert.match(table, /<select \[value\]="demandRepresentation\(\)"/);
  assert.match(table, /<option value="detailedCard">Cartão detalhado<\/option>/);
  assert.match(table, /<article class="demand-card" \[class\.demand-number\]="demandRepresentation\(\) === 'number'" tabindex="0"/);
  assert.match(table, /<span class="card-date-range-separator" aria-hidden="true">a<\/span>/);
  assert.doesNotMatch(table, /card-topline/);
  assert.match(table, /<dt>MÁX\.<\/dt>/);
  assert.doesNotMatch(table, /Tempo<br>médio/);
  assert.match(table, /<dt>P90<\/dt>/);
  assert.match(table, /<dt>P95<\/dt>/);
  assert.match(table, /<h2 \[title\]="status">\{\{ status \}\}<\/h2>/);
  assert.match(table, /\(pointerenter\)="showDemandHint\(\$event, item\)"/);
  assert.match(globalStylesheet, /\.lane-content\.number-representation \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("a linha do tempo e o grafo preservam contratos acessíveis", () => {
  assert.match(timeline, /<input class="timeline" type="range" min="0" \[max\]="timelineSliderMaximum\(\)" \[value\]="sliderInputValue\(\)"/);
  assert.match(timeline, /\[attr\.aria-valuetext\]="timelineLabel\(\)"/);
  assert.match(appTemplate, /\[timelineChart\]="timelineChart\(\)"/);
  assert.match(timeline, /<span class="timeline-chart-heading-label">Demandas não concluídas no desenvolvimento/);
  assert.match(timeline, /<button type="button" aria-label="Exibir situações consideradas no gráfico" aria-describedby="timeline-chart-scope-hint">\?<\/button>/);
  assert.match(timeline, /<span class="timeline-chart-scope-hint" id="timeline-chart-scope-hint" role="tooltip">Situações consideradas:/);
  assert.match(timeline, /<svg class="timeline-chart"[^>]*role="img"[^>]*\[attr\.aria-label\]="timelineChartAriaLabel\(\)"/);
  assert.match(timeline, /<polygon class="timeline-chart-area"/);
  assert.match(timeline, /<polyline class="timeline-chart-line"/);
  assert.match(timeline, /<text class="timeline-chart-scale timeline-chart-scale-start-max"[^>]*>{{ timelineChart\(\)\.maximum }}<\/text>/);
  assert.match(timeline, /<text class="timeline-chart-scale timeline-chart-scale-end-max"[^>]*>{{ timelineChart\(\)\.maximum }}<\/text>/);
  assert.match(timeline, /<text class="timeline-chart-scale timeline-chart-scale-start-zero"[^>]*>0<\/text>/);
  assert.match(timeline, /<text class="timeline-chart-scale timeline-chart-scale-end-zero"[^>]*>0<\/text>/);
  assert.match(timeline, /<line class="timeline-chart-current"/);
  assert.match(timeline, /<line class="timeline-chart-peak"/);
  assert.doesNotMatch(timeline, /timeline-chart-series-line|timeline-chart-legend/);
  assert.match(graph, /<svg class="graph-canvas" \[class\.is-playing\]="playing\(\)"/);
  assert.match(graph, /<path class="graph-transition" \[class\.active\]="transition\.activeDemandCount > 0"/);
  assert.match(graph, /\[attr\.stroke-width\]="transition\.strokeWidth"/);
  assert.match(graph, /<circle class="graph-phase-node"[^>]*r="13\.75"><\/circle>/);
  assert.match(graph, /<circle class="graph-demand"[^>]*\[attr\.stroke\]="demand\.routeColor"[^>]*tabindex="0"/);
  assert.match(graph, /<rect[^>]*\[attr\.stroke\]="demand\.routeColor"/);
  assert.match(graph, /<label class="demand-representation graph-routing-algorithm">Algoritmo do grafo/);
  assert.match(graph, /<option value="standard">Algoritmo padrão<\/option><option value="optimized">Algoritmo otimizado<\/option>/);
  assert.match(appTemplate, /\[graphRoutingAlgorithm\]="graphRoutingAlgorithm\(\)"/);
  assert.match(appTemplate, /\(setGraphRoutingAlgorithm\)="setGraphRoutingAlgorithm\(\$event\)"/);
  assert.match(graph, /<aside class="graph-legend" aria-label="Legenda das cores dos tipos de demanda">/);
  assert.match(globalStylesheet, /\.graph-transition\.active \{ stroke-opacity: 1;/);
  assert.doesNotMatch(globalStylesheet, /\.graph-transition\.active \{[^}]*stroke:/);
});

test("o estilo compartilhado preserva a geometria compacta", () => {
  assert.match(globalStylesheet, /\.app-shell \.flow \{ grid-auto-columns: 150px; \}/);
  assert.match(globalStylesheet, /\.app-shell \.lane \{ min-width: 150px; \}/);
  assert.match(globalStylesheet, /\.app-shell \.lane-header \{ height: auto; min-height: 112px; \}/);
  assert.match(globalStylesheet, /\.app-shell \.lane-header h2 \{ display: -webkit-box;[^}]*-webkit-line-clamp: 2;[^}]*text-overflow: ellipsis;/);
  assert.match(globalStylesheet, /\.app-shell \.lane-statistics \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(stylesheet, /\.lane-content \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(stylesheet, /\.time-control \{ margin: 0 0 12px; padding: 10px 0;/);
  assert.match(globalStylesheet, /\.app-shell \.timeline-slider \{ margin: 0 0 44px; \}/);
  assert.match(globalStylesheet, /\.app-shell \.selected-date \{ top: calc\(100% \+ 4px\); bottom: auto; \}/);
  assert.match(globalStylesheet, /\.timeline-chart \{[^}]*width: 100%; height: 82px;/);
  assert.match(globalStylesheet, /\.timeline-chart-scale \{[^}]*pointer-events: none/);
  assert.match(globalStylesheet, /\.timeline-chart-help:hover \.timeline-chart-scope-hint, \.timeline-chart-help:focus-within \.timeline-chart-scope-hint/);
  assert.match(stylesheet, /\.graph-phase-count \{ font-size: 7px;/);
  assert.match(globalStylesheet, /\.app-shell \.demand-card \{ padding: 7px; \}/);
  assert.match(globalStylesheet, /\.app-shell \.card-date-range \{ margin-inline: auto; text-align: center; \}/);
  assert.match(globalStylesheet, /\.app-shell \.demand-card h3 \{ font-size: 11px; font-weight: 400;[^}]*text-overflow: clip;[^}]*white-space: normal; \}/);
  assert.match(globalStylesheet, /\.demand-card\.demand-number h3 \{[^}]*font-weight: 400;/);
});
