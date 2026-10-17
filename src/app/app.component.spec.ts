import assert from "node:assert/strict";
import test from "node:test";

import "@angular/compiler";

import { AppComponent } from "./app.component";

type TestableApp = AppComponent & {
  parseRows(rows: Array<Record<string, unknown>>): Array<{ demandNumber: string; demandTitle: string; demandType: string; status: string; startedAt: Date; endedAt: Date }>;
  inferStatusOrder(histories: Array<{ name: string; events: Array<{ status: string }> }>): string[];
  separateGraphPorts(transitions: Array<{
    source: string;
    target: string;
    color: string;
    count: number;
    strokeWidth: number;
    path: string;
    points: Array<{ x: number; y: number }>;
  }>, phases: Array<{
    status: string;
    labelLines: string[];
    color: string;
    activeCount: number;
    x: number;
    y: number;
  }>): void;
  graphDemandLaneOffsets(count: number): number[];
  graphTransitionPoints(source: {
    status: string; labelLines: string[]; color: string; countColor: string; activeCount: number; x: number; y: number;
  }, target: {
    status: string; labelLines: string[]; color: string; countColor: string; activeCount: number; x: number; y: number;
  }, phases: Array<{
    status: string; labelLines: string[]; color: string; countColor: string; activeCount: number; x: number; y: number;
  }>, occupiedRoutes: Array<Array<{ x: number; y: number }>>): Array<{ x: number; y: number }>;
  graphRouteClearsLabels(points: Array<{ x: number; y: number }>, phases: Array<{
    status: string; labelLines: string[]; color: string; countColor: string; activeCount: number; x: number; y: number;
  }>): boolean;
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
    "Tipo de demanda": "Evolutiva",
    "Situação": "Desenvolvimento",
    "Data de início": "02/09/2026",
    "Data de fim": "18/09/2026",
  }]);

  assert.equal(events.length, 1);
  assert.equal(events[0].demandNumber, "DEM-200");
  assert.equal(events[0].demandTitle, "Acesso por SSO");
  assert.equal(events[0].demandType, "Evolutiva");
  assert.equal(events[0].status, "Desenvolvimento");
  assert.equal(events[0].startedAt.toLocaleDateString("pt-BR"), "02/09/2026");
});

test("atribui Sem tipo quando a planilha não tem a coluna opcional", () => {
  const app = new AppComponent() as TestableApp;
  const events = app.parseRows([{
    "Número da demanda": "DEM-201",
    "Título da demanda": "Acesso por SSO",
    "Situação": "Desenvolvimento",
    "Data de início": "02/09/2026",
    "Data de fim": "18/09/2026",
  }]);

  assert.equal(events[0].demandType, "Sem tipo");
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

test("infere as ligações do grafo e move a demanda pelo tempo da fase de origem", () => {
  const app = new AppComponent();
  const graphAtStart = app.graph();
  const discoveryToDevelopment = graphAtStart.transitions.find((transition) => transition.source === "Descoberta" && transition.target === "Desenvolvimento");
  const movingDemandAtStart = graphAtStart.demands.find((demand) => demand.number === "DEM-1042");

  assert.equal(discoveryToDevelopment?.count, 3);
  assert.ok(graphAtStart.transitions.every((transition) => transition.color === "#7d8793"));
  assert.equal(discoveryToDevelopment?.points.length, 2);
  assert.equal(discoveryToDevelopment?.strokeWidth, 1);
  assert.equal(movingDemandAtStart?.source, "Descoberta");
  assert.equal(movingDemandAtStart?.target, "Desenvolvimento");
  assert.equal(movingDemandAtStart?.item.event.status, "Descoberta");
  assert.equal(movingDemandAtStart?.progress, 0);
  assert.equal(new Set(graphAtStart.phases.map((phase) => phase.y)).size, 1);
  assert.ok(graphAtStart.phases.every((phase, index) => index === 0 || phase.x > graphAtStart.phases[index - 1].x));

  app.currentTime.set(new Date(2026, 7, 5).getTime());
  const movingDemandHalfway = app.graph().demands.find((demand) => demand.number === "DEM-1042");

  assert.equal(movingDemandHalfway?.progress, 50);
  assert.ok(movingDemandHalfway);
});

test("separa simetricamente chegada e saída que usam o topo de uma fase", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, x: number, y: number) => ({ status, labelLines: [status], color: "#889", activeCount: 0, x, y });
  const phases = [phase("Origem", 30, 30), phase("Em análise", 100, 100), phase("Destino", 170, 30)];
  const transitions = [
    { source: "Origem", target: "Em análise", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 30, y: 30 }, { x: 100, y: 60 }, { x: 100, y: 89 }] },
    { source: "Em análise", target: "Destino", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 100, y: 89 }, { x: 100, y: 60 }, { x: 170, y: 30 }] },
  ];

  app.separateGraphPorts(transitions, phases);

  assert.deepEqual(transitions[0].points.slice(-3), [{ x: 100, y: 60 }, { x: 102.5, y: 60 }, { x: 102.5, y: 86.25 }]);
  assert.deepEqual(transitions[1].points.slice(0, 3), [{ x: 97.5, y: 86.25 }, { x: 97.5, y: 60 }, { x: 100, y: 60 }]);
  assert.equal((transitions[0].points.at(-1)!.x + transitions[1].points[0].x) / 2, 100);
  assert.equal(transitions.flatMap((transition) => transition.points).some((point) => point.x === 100 && point.y === 86.25), false);
  assert.match(transitions[0].path, /L 100 60 L 102.5 60 L 102.5 86.25$/);
  assert.match(transitions[1].path, /^M 97.5 86.25 L 97.5 60 L 100 60/);
});

test("mantém o trecho longo reto ao separar chegadas pelo lado esquerdo", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, x: number, y: number) => ({ status, labelLines: [status], color: "#889", activeCount: 0, x, y });
  const phases = [phase("Origem A", 30, 100), phase("Origem B", 30, 160), phase("Destino", 100, 100)];
  const transitions = [
    { source: "Origem A", target: "Destino", color: "#789", count: 2, strokeWidth: 1.1, path: "", points: [{ x: 41, y: 100 }, { x: 89, y: 100 }] },
    { source: "Origem B", target: "Destino", color: "#789", count: 1, strokeWidth: .75, path: "", points: [{ x: 30, y: 149 }, { x: 89, y: 100 }] },
  ];

  app.separateGraphPorts(transitions, phases);

  assert.deepEqual(transitions[0].points, [{ x: 41, y: 100 }, { x: 78.25, y: 100 }, { x: 78.25, y: 97.5 }, { x: 86.25, y: 97.5 }]);
  assert.doesNotMatch(transitions[0].path, /^M 41 100 L 41 97.5/);
  assert.match(transitions[0].path, /L 78.25 100 L 78.25 97.5 L 86.25 97.5$/);
});

test("separa entradas que chegam pelo mesmo lado de uma fase", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, x: number, y: number) => ({ status, labelLines: [status], color: "#889", activeCount: 0, x, y });
  const phases = [phase("Origem A", 30, 30), phase("Em análise", 100, 100), phase("Origem B", 170, 30)];
  const transitions = [
    { source: "Origem A", target: "Em análise", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 30, y: 30 }, { x: 100, y: 60 }, { x: 100, y: 89 }] },
    { source: "Origem B", target: "Em análise", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 170, y: 30 }, { x: 100, y: 60 }, { x: 100, y: 89 }] },
  ];

  app.separateGraphPorts(transitions, phases);

  assert.deepEqual(transitions.map((transition) => transition.points.at(-1)!.x), [97.5, 102.5]);
  assert.deepEqual(transitions.map((transition) => transition.points.slice(-2)), [
    [{ x: 97.5, y: 60 }, { x: 97.5, y: 86.25 }],
    [{ x: 102.5, y: 60 }, { x: 102.5, y: 86.25 }],
  ]);
  assert.equal(transitions.flatMap((transition) => transition.points).some((point) => point.x === 100 && point.y === 86.25), false);
});

test("ordena as portas pela posição de chegada sem cruzar os segmentos finais", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, x: number, y: number) => ({ status, labelLines: [status], color: "#889", activeCount: 0, x, y });
  const phases = [phase("Z", 40, 30), phase("A", 80, 30), phase("Y", 120, 30), phase("B", 160, 30), phase("Destino", 100, 100)];
  const transitions = [
    { source: "Z", target: "Destino", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 40, y: 30 }, { x: 40, y: 60 }, { x: 100, y: 89 }] },
    { source: "A", target: "Destino", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 80, y: 30 }, { x: 80, y: 60 }, { x: 100, y: 89 }] },
    { source: "Y", target: "Destino", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 120, y: 30 }, { x: 120, y: 60 }, { x: 100, y: 89 }] },
    { source: "B", target: "Destino", color: "#789", count: 1, strokeWidth: 1, path: "", points: [{ x: 160, y: 30 }, { x: 160, y: 60 }, { x: 100, y: 89 }] },
  ];

  app.separateGraphPorts(transitions, phases);

  assert.deepEqual(transitions.map((transition) => transition.points.at(-1)!.x), [92.5, 97.5, 102.5, 107.5]);
  assert.ok(transitions.every((transition) => transition.points.at(-2)!.x === transition.points.at(-1)!.x));
});

test("desvia uma ligação vertical para não atravessar o rótulo do nó", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, y: number) => ({ status, labelLines: [status], color: "#889", countColor: "#fff", activeCount: 0, x: 100, y });
  const phases = [phase("Origem", 42), phase("Destino", 117)];

  const points = app.graphTransitionPoints(phases[0], phases[1], phases, []);

  assert.equal(points[0].y, phases[0].y);
  assert.notEqual(points[0].x, phases[0].x);
  assert.equal(points.at(-1)!.y, phases[1].y);
  assert.notEqual(points.at(-1)!.x, phases[1].x);
  assert.equal(app.graphRouteClearsLabels(points, phases), true);
});

test("distribui demandas na mesma ligação em faixas laterais", () => {
  const app = new AppComponent() as TestableApp;

  assert.deepEqual(app.graphDemandLaneOffsets(1), [0]);
  assert.deepEqual(app.graphDemandLaneOffsets(2), [-4.5, 4.5]);
  assert.deepEqual(app.graphDemandLaneOffsets(3), [0, -9, 9]);
  assert.deepEqual(app.graphDemandLaneOffsets(4), [-4.5, 4.5, -13.5, 13.5]);
});

test("escurece os nós do grafo conforme a carga visível da fase", () => {
  const app = new AppComponent();
  app.events.set([
    { demandNumber: "DEM-1", demandTitle: "Primeira triagem", demandType: "Evolutiva", status: "Triagem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 2 },
    { demandNumber: "DEM-1", demandTitle: "Primeira triagem", demandType: "Evolutiva", status: "Atendimento", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 3 },
    { demandNumber: "DEM-2", demandTitle: "Segunda triagem", demandType: "Evolutiva", status: "Triagem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 4 },
    { demandNumber: "DEM-2", demandTitle: "Segunda triagem", demandType: "Evolutiva", status: "Atendimento", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 5 },
    { demandNumber: "DEM-3", demandTitle: "Entrega isolada", demandType: "Corretiva", status: "Entrega", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 6 },
  ]);
  app.currentTime.set(new Date(2026, 0, 1).getTime());

  const phases = app.graph().phases;
  const triagem = phases.find((phase) => phase.status === "Triagem");
  const entrega = phases.find((phase) => phase.status === "Entrega");
  const atendimento = phases.find((phase) => phase.status === "Atendimento");
  const lightness = (color: string) => Number(color.match(/(\d+\.\d+)%\)$/)?.[1]);

  assert.equal(triagem?.activeCount, 2);
  assert.equal(entrega?.activeCount, 1);
  assert.equal(atendimento?.activeCount, 0);
  assert.equal(triagem?.countColor, "#f7f9fc");
  assert.equal(atendimento?.countColor, "#354254");
  assert.equal(atendimento?.color, "hsl(215 10% 88.0%)");
  assert.ok(lightness(triagem?.color ?? "") < lightness(entrega?.color ?? ""));
  assert.ok(lightness(entrega?.color ?? "") < lightness(atendimento?.color ?? ""));
});

test("percorre etapas da mesma data em subpassos na tabela e no grafo", () => {
  const app = new AppComponent();
  const sameDay = new Date(2026, 8, 15).getTime();
  app.events.set([
    { demandNumber: "DEM-MESMO-DIA", demandTitle: "Transição sequencial", demandType: "Evolutiva", status: "Em Homologação", startedAt: new Date(2026, 8, 15), endedAt: new Date(2026, 8, 15), row: 2 },
    { demandNumber: "DEM-MESMO-DIA", demandTitle: "Transição sequencial", demandType: "Evolutiva", status: "Entregue", startedAt: new Date(2026, 8, 15), endedAt: new Date(2026, 8, 16), row: 3 },
  ]);

  app.currentTime.set(sameDay);
  const startDemand = app.graph().demands.find((demand) => demand.number === "DEM-MESMO-DIA");
  assert.equal(app.activeByStatus().get("Em Homologação")?.[0].number, "DEM-MESMO-DIA");
  assert.equal(startDemand?.source, "Em Homologação");
  assert.equal(startDemand?.target, "Entregue");
  assert.equal(startDemand?.progress, 0);

  app.currentTime.set(sameDay + 6 * 60 * 60 * 1000);
  const halfwayDemand = app.graph().demands.find((demand) => demand.number === "DEM-MESMO-DIA");
  assert.equal(halfwayDemand?.progress, 50);
  assert.match(app.timelineLabel(), /sequência do dia/);
  assert.ok(app.statusMetrics().has("Entregue"));

  app.currentTime.set(sameDay + 12 * 60 * 60 * 1000 + 1);
  const deliveredDemand = app.graph().demands.find((demand) => demand.number === "DEM-MESMO-DIA");
  const deliveredPhase = app.graph().phases.find((phase) => phase.status === "Entregue");
  assert.equal(app.activeByStatus().get("Entregue")?.[0].number, "DEM-MESMO-DIA");
  assert.equal(deliveredDemand, undefined);
  assert.equal(deliveredPhase?.activeCount, 1);
  assert.equal(app.events()[0].startedAt.getTime(), sameDay);
  assert.equal(app.events()[0].endedAt.getTime(), sameDay);
});

test("desvia uma ligação quando outra fase ocupa seu trajeto", () => {
  const app = new AppComponent() as TestableApp;
  app.events.set([
    { demandNumber: "DEM-SALTO", demandTitle: "Salto de fase", demandType: "Evolutiva", status: "Origem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 3), row: 2 },
    { demandNumber: "DEM-SALTO", demandTitle: "Salto de fase", demandType: "Evolutiva", status: "Destino", startedAt: new Date(2026, 0, 4), endedAt: new Date(2026, 0, 5), row: 3 },
    { demandNumber: "DEM-COMPLETA", demandTitle: "Caminho completo", demandType: "Evolutiva", status: "Origem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 4 },
    { demandNumber: "DEM-COMPLETA", demandTitle: "Caminho completo", demandType: "Evolutiva", status: "Intermediária", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 5 },
    { demandNumber: "DEM-COMPLETA", demandTitle: "Caminho completo", demandType: "Evolutiva", status: "Destino", startedAt: new Date(2026, 0, 3), endedAt: new Date(2026, 0, 3), row: 6 },
  ]);

  const graph = app.graph();
  const skippedTransition = graph.transitions.find((transition) => transition.source === "Origem" && transition.target === "Destino");
  const intermediatePhase = graph.phases.find((phase) => phase.status === "Intermediária");

  assert.ok(skippedTransition);
  assert.ok(intermediatePhase);
  const shortestDistanceToIntermediate = skippedTransition.points.slice(1).reduce((shortest, end, index) => {
    const start = skippedTransition.points[index];
    const horizontal = end.x - start.x;
    const vertical = end.y - start.y;
    const squaredLength = horizontal ** 2 + vertical ** 2;
    const ratio = squaredLength === 0 ? 0 : Math.min(1, Math.max(0, ((intermediatePhase.x - start.x) * horizontal + (intermediatePhase.y - start.y) * vertical) / squaredLength));
    return Math.min(shortest, Math.hypot(intermediatePhase.x - (start.x + horizontal * ratio), intermediatePhase.y - (start.y + vertical * ratio)));
  }, Number.POSITIVE_INFINITY);

  assert.ok(skippedTransition.points.length > 2);
  assert.ok(skippedTransition.points.some((point) => point.y < intermediatePhase.y));
  assert.ok(skippedTransition.points.every((point) => point.y <= intermediatePhase.y));
  assert.ok(shortestDistanceToIntermediate >= 32.75);
  assert.equal(app.graphRouteClearsLabels(skippedTransition.points, graph.phases), true);
  assert.match(skippedTransition.path, /^M .* L /);
});

test("separa em faixas vizinhas os desvios que usariam o mesmo corredor", () => {
  const app = new AppComponent();
  app.events.set([
    { demandNumber: "DEM-AC", demandTitle: "Primeiro salto", demandType: "Evolutiva", status: "A", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 2 },
    { demandNumber: "DEM-AC", demandTitle: "Primeiro salto", demandType: "Evolutiva", status: "C", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 3 },
    { demandNumber: "DEM-BD", demandTitle: "Segundo salto", demandType: "Evolutiva", status: "B", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 4 },
    { demandNumber: "DEM-BD", demandTitle: "Segundo salto", demandType: "Evolutiva", status: "D", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 5 },
  ]);

  const transitions = app.graph().transitions;
  const firstJump = transitions.find((transition) => transition.source === "A" && transition.target === "C");
  const secondJump = transitions.find((transition) => transition.source === "B" && transition.target === "D");
  const horizontalLane = (points: Array<{ x: number; y: number }>) => points.slice(1).find((point, index) => point.y === points[index].y && Math.abs(point.x - points[index].x) > 100)?.y;

  assert.ok(firstJump);
  assert.ok(secondJump);
  const firstLane = horizontalLane(firstJump.points);
  const secondLane = horizontalLane(secondJump.points);

  assert.notEqual(firstLane, secondLane);
  assert.equal(Math.abs(firstLane! - secondLane!), 6);
});

test("abre novos níveis superiores para ligações concorrentes", () => {
  const app = new AppComponent() as TestableApp;
  const phase = (status: string, x: number) => ({ status, labelLines: [status], color: "#889", countColor: "#fff", activeCount: 0, x, y: 60 });
  const phases = [phase("A", 38), phase("B", 130), phase("C", 223), phase("D", 315), phase("E", 408)];
  const pairs = [[0, 4], [0, 3], [1, 4], [1, 3]];
  const occupiedRoutes: Array<Array<{ x: number; y: number }>> = [];
  const routes = pairs.map(([source, target]) => {
    const route = app.graphTransitionPoints(phases[source], phases[target], phases, occupiedRoutes);
    occupiedRoutes.push(route);
    return route;
  });
  const horizontalLane = (points: Array<{ x: number; y: number }>) => points.slice(1)
    .find((point, index) => point.y === points[index].y && Math.abs(point.x - points[index].x) > 100)?.y;
  const lanes = routes.map(horizontalLane);

  assert.equal(new Set(lanes).size, routes.length);
  assert.ok(lanes.every((lane) => lane !== undefined && lane < phases[0].y));
});

test("mantém espessura uniforme mesmo em transições muito frequentes", () => {
  const app = new AppComponent();
  app.events.set(Array.from({ length: 100 }, (_, index) => [
    {
      demandNumber: `DEM-${index + 1}`,
      demandTitle: `Demanda ${index + 1}`,
      demandType: "Evolutiva",
      status: "Origem",
      startedAt: new Date(2026, 0, 1),
      endedAt: new Date(2026, 0, 2),
      row: index * 2 + 2,
    },
    {
      demandNumber: `DEM-${index + 1}`,
      demandTitle: `Demanda ${index + 1}`,
      demandType: "Evolutiva",
      status: "Destino",
      startedAt: new Date(2026, 0, 3),
      endedAt: new Date(2026, 0, 4),
      row: index * 2 + 3,
    },
  ]).flat());

  const transition = app.graph().transitions.find((item) => item.source === "Origem" && item.target === "Destino");

  assert.equal(transition?.count, 100);
  assert.equal(transition?.strokeWidth, 1);
});

test("organiza as fases e os arcos no formato de grafo circular", () => {
  const app = new AppComponent();
  const circularGraph = app.circularGraph();
  const radius = (phase: { x: number; y: number }) => Math.hypot(phase.x - 500, phase.y - 280);

  assert.equal(circularGraph.height, 560);
  assert.equal(circularGraph.phases.length, app.visibleStatusOrder().length);
  assert.ok(circularGraph.phases.every((phase) => Math.abs(radius(phase) - 160) < 0.001));
  assert.ok(circularGraph.transitions.every((transition) => transition.points.length > 2));
  assert.ok(circularGraph.transitions.every((transition) => transition.path.includes(" C ") || transition.path.includes(" A ")));
  assert.equal(circularGraph.demands.length, app.graph().demands.length);
  const movingDemand = circularGraph.demands.find((demand) => demand.number === "DEM-1042");
  const movingRoute = circularGraph.transitions.find((transition) => transition.source === movingDemand?.source && transition.target === movingDemand?.target);
  assert.ok(movingDemand);
  assert.ok(movingRoute);
  assert.equal(movingDemand.x, movingRoute.points[0].x);
  assert.equal(movingDemand.y, movingRoute.points[0].y);
});

test("desvia curvas circulares que cruzariam outra ligação ou uma fase", () => {
  const app = new AppComponent();
  app.events.set([
    { demandNumber: "DEM-AC", demandTitle: "Ligação vertical", demandType: "Evolutiva", status: "A", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 2 },
    { demandNumber: "DEM-AC", demandTitle: "Ligação vertical", demandType: "Evolutiva", status: "C", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 3 },
    { demandNumber: "DEM-BD", demandTitle: "Ligação horizontal", demandType: "Evolutiva", status: "B", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 1), row: 4 },
    { demandNumber: "DEM-BD", demandTitle: "Ligação horizontal", demandType: "Evolutiva", status: "D", startedAt: new Date(2026, 0, 2), endedAt: new Date(2026, 0, 2), row: 5 },
  ]);

  const graph = app.circularGraph();
  const vertical = graph.transitions.find((transition) => transition.source === "A" && transition.target === "C");
  const horizontal = graph.transitions.find((transition) => transition.source === "B" && transition.target === "D");
  const intermediatePhase = graph.phases.find((phase) => phase.status === "C");
  const distanceToSegment = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const horizontalDistance = end.x - start.x;
    const verticalDistance = end.y - start.y;
    const length = horizontalDistance ** 2 + verticalDistance ** 2;
    const ratio = length === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - start.x) * horizontalDistance + (point.y - start.y) * verticalDistance) / length));
    return Math.hypot(point.x - (start.x + horizontalDistance * ratio), point.y - (start.y + verticalDistance * ratio));
  };
  const closestDistance = (first: Array<{ x: number; y: number }>, second: Array<{ x: number; y: number }>) => first.slice(2, -3).reduce((closest, point) => Math.min(
    closest,
    ...second.slice(2, -3).map((_, secondIndex) => distanceToSegment(point, second[secondIndex + 2], second[secondIndex + 3])),
  ), Number.POSITIVE_INFINITY);

  assert.ok(vertical);
  assert.ok(horizontal);
  assert.ok(intermediatePhase);
  assert.ok(closestDistance(vertical.points, horizontal.points) >= 30);
  assert.ok(horizontal.points.slice(1).every((point, index) => distanceToSegment(intermediatePhase, horizontal.points[index], point) >= 30));
  assert.ok([vertical.path, horizontal.path].some((path) => path.includes(" A ")));
});

test("mantém as demandas circulares sobre o traçado da ligação", () => {
  const app = new AppComponent();
  app.events.set([
    { demandNumber: "DEM-1", demandTitle: "Primeira demanda", demandType: "Evolutiva", status: "Origem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 5), row: 2 },
    { demandNumber: "DEM-1", demandTitle: "Primeira demanda", demandType: "Evolutiva", status: "Destino", startedAt: new Date(2026, 0, 6), endedAt: new Date(2026, 0, 6), row: 3 },
    { demandNumber: "DEM-2", demandTitle: "Segunda demanda", demandType: "Evolutiva", status: "Origem", startedAt: new Date(2026, 0, 1), endedAt: new Date(2026, 0, 5), row: 4 },
    { demandNumber: "DEM-2", demandTitle: "Segunda demanda", demandType: "Evolutiva", status: "Destino", startedAt: new Date(2026, 0, 6), endedAt: new Date(2026, 0, 6), row: 5 },
  ]);
  app.currentTime.set(new Date(2026, 0, 3).getTime());

  const graph = app.circularGraph();
  const route = graph.transitions.find((transition) => transition.source === "Origem" && transition.target === "Destino");
  const demands = graph.demands.filter((demand) => demand.source === "Origem" && demand.target === "Destino");
  const distanceToSegment = (point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) => {
    const horizontal = end.x - start.x;
    const vertical = end.y - start.y;
    const length = horizontal ** 2 + vertical ** 2;
    const ratio = length === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - start.x) * horizontal + (point.y - start.y) * vertical) / length));
    return Math.hypot(point.x - (start.x + horizontal * ratio), point.y - (start.y + vertical * ratio));
  };

  assert.ok(route);
  assert.equal(demands.length, 2);
  assert.equal(demands[0].x, demands[1].x);
  assert.equal(demands[0].y, demands[1].y);
  for (const demand of demands) {
    assert.ok(route.points.slice(1).some((point, index) => distanceToSegment(demand, route.points[index], point) < 0.001));
  }
});

test("distribui fases em novos níveis antes que os nós se sobreponham", () => {
  const app = new AppComponent();
  app.events.set(Array.from({ length: 12 }, (_, index) => ({
    demandNumber: `DEM-${index + 1}`,
    demandTitle: `Demanda ${index + 1}`,
    demandType: "Evolutiva",
    status: `Fase ${index + 1}`,
    startedAt: new Date(2026, 0, index + 1),
    endedAt: new Date(2026, 0, index + 1),
    row: index + 2,
  })));

  const graph = app.graph();
  const positions = new Set(graph.phases.map((phase) => `${phase.x}:${phase.y}`));

  assert.equal(positions.size, 12);
  assert.equal(new Set(graph.phases.slice(0, 11).map((phase) => phase.y)).size, 1);
  assert.equal(new Set(graph.phases.map((phase) => phase.y)).size, 2);
  assert.ok(graph.height > 150);
});

test("alterna entre os formatos de tabela e grafo", () => {
  const app = new AppComponent();

  assert.equal(app.activeVisualization(), "table");
  app.setVisualization("graph");
  assert.equal(app.activeVisualization(), "graph");
  app.setVisualization("circularGraph");
  assert.equal(app.activeVisualization(), "circularGraph");
  app.setVisualization("table");
  assert.equal(app.activeVisualization(), "table");
});

test("o cursor pode retornar ao início ao ser arrastado", () => {
  const app = new AppComponent();
  app.scrub({ target: { value: "10000" } } as unknown as Event);
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

test("formata as datas compactas do card em dd/mmm", () => {
  const app = new AppComponent();

  assert.equal(app.cardDateLabel(new Date(2026, 0, 3)), "03/jan");
  assert.equal(app.cardDateLabel(new Date(2026, 11, 19)), "19/dez");
});

test("cada botão de filtro alterna a exibição de sua lista", () => {
  const app = new AppComponent();

  assert.equal(app.visibilityFilterExpanded("status"), false);
  app.toggleVisibilityFilter("status");
  assert.equal(app.visibilityFilterExpanded("status"), true);
  app.toggleVisibilityFilter("status");
  assert.equal(app.visibilityFilterExpanded("status"), false);
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

test("a checkbox de situação alterna somente a situação escolhida", () => {
  const app = new AppComponent();
  const hiddenStatus = app.statusOrder()[0];
  assert.ok(hiddenStatus);

  app.toggleStatusVisibility(hiddenStatus);

  assert.equal(app.statusVisible(hiddenStatus), false);
  assert.equal(app.visibleStatusOrder().includes(hiddenStatus), false);
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

test("a checkbox de demanda oculta os cards e atualiza o contador", () => {
  const app = new AppComponent();
  const activeDemand = [...app.activeByStatus().values()][0]?.[0];
  assert.ok(activeDemand);
  const initialCount = app.activeCount();

  app.toggleDemandVisibility(activeDemand.number);

  assert.equal(app.demandVisible(activeDemand.number), false);
  assert.equal(app.activeCount(), initialCount - 1);
});

test("a checkbox de tipo oculta os cards e atualiza o contador", () => {
  const app = new AppComponent();
  const activeDemand = [...app.activeByStatus().values()][0]?.[0];
  assert.ok(activeDemand);
  const initialCount = app.activeCount();

  app.toggleDemandTypeVisibility(activeDemand.demandType);

  assert.equal(app.demandTypeVisible(activeDemand.demandType), false);
  assert.equal(app.activeCount(), initialCount - 1);
});

test("a cor do número da demanda é estável para cada tipo", () => {
  const app = new AppComponent();

  assert.equal(app.demandTypeColor("Corretiva"), app.demandTypeColor("Corretiva"));
  assert.notEqual(app.demandTypeColor("Corretiva"), app.demandTypeColor("Evolutiva"));
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
