import assert from "node:assert/strict";
import test from "node:test";

import "@angular/compiler";

import { AppComponent } from "./app.component";

type TestableApp = AppComponent & {
  parseRows(rows: Array<Record<string, unknown>>): Array<{ demand: string; status: string; startedAt: Date; endedAt: Date }>;
  inferStatusOrder(histories: Array<{ name: string; events: Array<{ status: string }> }>): string[];
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
