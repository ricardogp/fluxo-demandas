import assert from "node:assert/strict";
import test from "node:test";

import "@angular/compiler";

import { AppComponent } from "./app.component";

type TestableApp = AppComponent & {
  parseRows(rows: Array<Record<string, unknown>>): Array<{ demand: string; status: string; startedAt: Date; endedAt: Date }>;
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
    "Nome da demanda": "Acesso por SSO",
    "Situação": "Desenvolvimento",
    "Data de início": "02/09/2026",
    "Data de fim": "18/09/2026",
  }]);

  assert.equal(events.length, 1);
  assert.equal(events[0].demand, "Acesso por SSO");
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
