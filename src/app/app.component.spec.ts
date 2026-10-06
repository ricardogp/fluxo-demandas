import assert from "node:assert/strict";
import test from "node:test";

import "@angular/compiler";

import { AppComponent } from "./app.component";

type TestableApp = AppComponent & {
  parseRows(rows: Array<Record<string, unknown>>): Array<{ demandNumber: string; demandTitle: string; status: string; startedAt: Date; endedAt: Date }>;
  inferStatusOrder(histories: Array<{ name: string; events: Array<{ status: string }> }>): string[];
  calculateStatusMetrics(events: Array<{ demand: string; status: string; startedAt: Date; endedAt: Date; row: number }>, asOf: number): Map<string, {
    maxConcurrent: number;
    averageMs: number;
    p90Ms: number;
    p95Ms: number;
  }>;
};

test("lê cabeçalhos normalizados e datas brasileiras", () => {
  const app = new AppComponent() as TestableApp;
  const events = app.parseRows([{
    "Número da demanda": "DEM-200",
    "Título da demanda": "Acesso por SSO",
    "Situação": "Desenvolvimento",
    "Data de início": "02/09/2026",
    "Data de fim": "18/09/2026",
  }]);

  assert.equal(events.length, 1);
  assert.equal(events[0].demandNumber, "DEM-200");
  assert.equal(events[0].demandTitle, "Acesso por SSO");
  assert.equal(events[0].status, "Desenvolvimento");
  assert.equal(events[0].startedAt.toLocaleDateString("pt-BR"), "02/09/2026");
});

test("infere uma sequência a partir das transições históricas", () => {
  const app = new AppComponent() as TestableApp;
  const sequence = app.inferStatusOrder([
    { name: "A", events: [{ status: "Análise" }, { status: "Desenvolvimento" }, { status: "Testes" }] },
    { name: "B", events: [{ status: "Análise" }, { status: "Desenvolvimento" }, { status: "Testes" }] },
    { name: "C", events: [{ status: "Análise" }, { status: "Testes" }] },
  ]);

  assert.deepEqual(sequence, ["Análise", "Desenvolvimento", "Testes"]);
});

test("o cursor pode retornar ao início ao ser arrastado", () => {
  const app = new AppComponent();
  app.scrub({ target: { value: "1000" } } as unknown as Event);
  const end = app.currentTime();
  app.scrub({ target: { value: "0" } } as unknown as Event);

  assert.equal(app.currentTime(), app.timelineStart().getTime());
  assert.ok(end > app.currentTime());
});

test("inicia no tema claro e alterna para o tema escuro", () => {
  const app = new AppComponent();
  assert.equal(app.theme(), "light");
  app.toggleTheme();
  assert.equal(app.theme(), "dark");
  app.toggleTheme();
  assert.equal(app.theme(), "light");
});

test("oculta apenas a situação selecionada no filtro", () => {
  const app = new AppComponent();
  const status = app.statusOrder()[0];
  assert.ok(status);
  assert.equal(app.statusVisible(status), true);
  app.toggleStatusVisibility(status);
  assert.equal(app.statusVisible(status), false);
  assert.equal(app.visibleStatusOrder().includes(status), false);
  app.toggleStatusVisibility(status);
  assert.equal(app.statusVisible(status), true);
});

test("o contador em andamento respeita as situações visíveis", () => {
  const app = new AppComponent();
  const [status, activeItems] = [...app.activeByStatus().entries()][0] ?? [];
  assert.ok(status);
  assert.ok(activeItems);
  const initialCount = app.activeCount();

  app.toggleStatusVisibility(status);

  assert.equal(app.activeCount(), initialCount - activeItems.length);
});

test("o painel da demanda mostra o tempo acumulado até o passo selecionado", () => {
  const app = new AppComponent();
  const activeDemand = [...app.activeByStatus().values()][0]?.[0];
  assert.ok(activeDemand);

  assert.deepEqual(app.demandDurations(activeDemand), [{ status: "Descoberta", durationMs: 86_400_000 }]);
});

test("calcula indicadores de tempo e pico por situação", () => {
  const day = 86_400_000;
  const app = new AppComponent() as TestableApp;
  const metrics = app.calculateStatusMetrics([
    { demand: "Acesso", status: "Análise", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 2 },
    { demand: "Relatório", status: "Análise", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 3), row: 3 },
    { demand: "Portal", status: "Análise", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 6), row: 4 },
  ], new Date(2026, 0, 6).getTime()).get("Análise");

  assert.ok(metrics);
  assert.equal(metrics.maxConcurrent, 3);
  assert.equal(metrics.averageMs, 3 * day);
  assert.equal(metrics.p90Ms, 5 * day);
  assert.equal(metrics.p95Ms, 5 * day);
});

test("recalcula as métricas com a permanência parcial do passo atual", () => {
  const day = 86_400_000;
  const app = new AppComponent() as TestableApp;
  const metrics = app.calculateStatusMetrics([{
    demand: "Portal", status: "Desenvolvimento", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 10), row: 2,
  }], new Date(2026, 0, 3).getTime()).get("Desenvolvimento");

  assert.ok(metrics);
  assert.equal(metrics.maxConcurrent, 1);
  assert.equal(metrics.averageMs, 3 * day);
  assert.equal(metrics.p90Ms, 3 * day);
  assert.equal(metrics.p95Ms, 3 * day);
});
