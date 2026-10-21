import { Component, computed, signal, ViewEncapsulation } from "@angular/core";
import {
  ActiveDemand, ActiveHint, DemandEvent, DemandHistory, DemandRepresentation,
  GraphDemandNode, GraphDemandRepresentation, GraphPhaseLoadState, GraphPhaseNode, GraphPoint, GraphRoutingAlgorithm, GraphTransition,
  GraphView, PhaseHint, PhaseVisit, StatusDuration, StatusMetrics, TimelineChartView, TimelineEvent,
  VisibilityFilter, VisualizationFormat,
} from "./domain/demand.models";
import { AppHeaderComponent } from "./components/app-header.component";
import { FlowGraphComponent } from "./components/flow-graph.component";
import { TableFlowComponent } from "./components/table-flow.component";
import { TimelineControlsComponent } from "./components/timeline-controls.component";
import { VisibilityFiltersComponent } from "./components/visibility-filters.component";
import { SpreadsheetImporter } from "./services/spreadsheet-importer";

type GraphPortSide = "top" | "right" | "bottom" | "left";
interface GraphPhasePort {
  transition: GraphTransition;
  pointIndex: number;
  phase: GraphPhaseNode;
  kind: "incoming" | "outgoing";
  side: GraphPortSide;
  offset?: number;
}
interface GraphRouteTraversal {
  key: string;
  route: string;
  startedAt: Date;
  endedAt: Date;
}
interface GraphRouteRequest {
  key: string;
  source: GraphPhaseNode;
  target: GraphPhaseNode;
}
interface TimelineChartSegment {
  start: number;
  end: number;
  total: number;
}

const SAMPLE_EVENTS: DemandEvent[] = [
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", demandType: "Evolutiva", status: "Descoberta", startedAt: new Date(2026, 7, 3), endedAt: new Date(2026, 7, 7), row: 2 },
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", demandType: "Evolutiva", status: "Desenvolvimento", startedAt: new Date(2026, 7, 8), endedAt: new Date(2026, 7, 22), row: 3 },
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", demandType: "Evolutiva", status: "Validação", startedAt: new Date(2026, 7, 23), endedAt: new Date(2026, 7, 27), row: 4 },
  { demandNumber: "DEM-1057", demandTitle: "Central de ajuda", demandType: "Corretiva", status: "Descoberta", startedAt: new Date(2026, 7, 9), endedAt: new Date(2026, 7, 12), row: 5 },
  { demandNumber: "DEM-1057", demandTitle: "Central de ajuda", demandType: "Corretiva", status: "Desenvolvimento", startedAt: new Date(2026, 7, 13), endedAt: new Date(2026, 8, 2), row: 6 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", demandType: "Sustentação", status: "Descoberta", startedAt: new Date(2026, 7, 16), endedAt: new Date(2026, 7, 18), row: 7 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", demandType: "Sustentação", status: "Desenvolvimento", startedAt: new Date(2026, 7, 19), endedAt: new Date(2026, 8, 4), row: 8 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", demandType: "Sustentação", status: "Validação", startedAt: new Date(2026, 8, 5), endedAt: new Date(2026, 8, 10), row: 9 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", demandType: "Sustentação", status: "Entregue", startedAt: new Date(2026, 8, 11), endedAt: new Date(2026, 8, 11), row: 10 },
];

const MONTH_ABBREVIATIONS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const GRAPH_WIDTH = 1000;
const GRAPH_MIN_HEIGHT = 220;
const GRAPH_PHASE_RADIUS = 13.75;
const GRAPH_FLOW_PADDING = 38;
const GRAPH_PHASE_MIN_WIDTH = 80;
const GRAPH_LEVEL_GAP = 180;
const GRAPH_TOP_PADDING = 90;
const GRAPH_BOTTOM_PADDING = 110;
const GRAPH_TRANSITION_STROKE_WIDTH = 1;
const GRAPH_ROUTE_CLEARANCE = 19;
const GRAPH_HORIZONTAL_ROUTE_CLEARANCE = 62;
const GRAPH_ROUTE_SEPARATION = 6;
const GRAPH_ROUTE_CHANNEL_LEVELS = 4;
const GRAPH_ROUTE_OVERLAP_PENALTY = 10_000;
const GRAPH_ROUTE_SPACING_COST = 0.35;
const GRAPH_ROUTE_CROSSING_PENALTY = 25_000;
const GRAPH_OPTIMIZED_ROUTE_OVERLAP_PENALTY = 100_000;
const GRAPH_OPTIMIZED_ROUTE_CANDIDATES_PER_SIDE = 8;
const GRAPH_OPTIMIZATION_PASSES = 2;
const GRAPH_PHASE_PORT_SEPARATION = 5;
const GRAPH_PHASE_PORT_ELBOW_DISTANCE = 8;
const GRAPH_DEMAND_LANE_SEPARATION = 9;
const GRAPH_ALWAYS_NEUTRAL_PHASES = new Set(["aberta", "cancelada", "concluida", "em encerramento", "entregue"]);
const DAY_IN_MS = 86_400_000;
const TIMELINE_SLIDER_MAXIMUM = 10_000;
const TIMELINE_CHART_WIDTH = 1000;
const TIMELINE_CHART_HEIGHT = 82;
const TIMELINE_CHART_TOP = 6;
const TIMELINE_CHART_BASELINE = 76;
const TIMELINE_CHART_STATUSES = [
  "Em atendimento",
  "Em homologação",
  "Aguardando homologação",
  "Homologada",
  "Homologada com implantação autorizada",
  "Em implantação",
] as const;
const timelineChartStatusKey = (status: string) => status.normalize("NFC").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
const TIMELINE_CHART_STATUS_KEYS = new Set<string>(TIMELINE_CHART_STATUSES.map(timelineChartStatusKey));

@Component({
  selector: "app-root",
  imports: [AppHeaderComponent, FlowGraphComponent, TableFlowComponent, TimelineControlsComponent, VisibilityFiltersComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  readonly speedOptions = [0.5, 1, 2, 5, 10, 25];
  readonly events = signal<DemandEvent[]>(SAMPLE_EVENTS);
  readonly theme = signal<"light" | "dark">("light");
  readonly hiddenStatuses = signal<Set<string>>(new Set());
  readonly hiddenDemands = signal<Set<string>>(new Set());
  readonly hiddenDemandTypes = signal<Set<string>>(new Set());
  readonly expandedVisibilityFilters = signal<Set<VisibilityFilter>>(new Set());
  readonly activeHint = signal<ActiveHint | undefined>(undefined);
  readonly phaseHint = signal<PhaseHint | undefined>(undefined);
  readonly speed = signal(1);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly sourceName = signal("Exemplo de simulação");
  readonly currentTime = signal(this.timelineStart().getTime());
  readonly activeVisualization = signal<VisualizationFormat>("table");
  readonly demandRepresentation = signal<DemandRepresentation>("detailedCard");
  readonly graphDemandRepresentation = signal<GraphDemandRepresentation>("circle");
  readonly graphRoutingAlgorithm = signal<GraphRoutingAlgorithm>("standard");
  readonly timelineSliderMaximum = TIMELINE_SLIDER_MAXIMUM;

  private animationFrame?: number;
  private lastFrame?: number;
  private readonly spreadsheetImporter = new SpreadsheetImporter();
  // Function bindings keep presentation components independent from the store
  // while retaining the same derived-state rules in this container.
  readonly presentation = {
    visibilityFilterExpanded: (filter: VisibilityFilter) => this.visibilityFilterExpanded(filter),
    statusVisible: (status: string) => this.statusVisible(status),
    demandVisible: (number: string) => this.demandVisible(number),
    demandTypeVisible: (demandType: string) => this.demandTypeVisible(demandType),
    laneColor: (status: string) => this.laneColor(status),
    demandTypeColor: (demandType: string) => this.demandTypeColor(demandType),
    rangeLabel: (date: Date) => this.rangeLabel(date),
    cardDateLabel: (date: Date) => this.cardDateLabel(date),
    durationLabel: (durationMs: number) => this.durationLabel(durationMs),
    phaseHintId: (status: string) => this.phaseHintId(status),
  };

  readonly histories = computed<DemandHistory[]>(() => {
    const byDemand = new Map<string, DemandEvent[]>();
    for (const event of this.events()) {
      const history = byDemand.get(event.demandNumber) ?? [];
      history.push(event);
      byDemand.set(event.demandNumber, history);
    }

    return [...byDemand.entries()]
      .map(([number, events]) => {
        const chronologicalEvents = [...events].sort((first, second) => first.startedAt.getTime() - second.startedAt.getTime() || first.row - second.row);
        return {
          number,
          title: chronologicalEvents[0].demandTitle,
          demandType: chronologicalEvents[0].demandType,
          events: this.createTimelineEvents(chronologicalEvents),
        };
      })
      .sort((first, second) => first.number.localeCompare(second.number, "pt-BR", { numeric: true }));
  });

  readonly statusOrder = computed(() => this.inferStatusOrder(this.histories()));
  readonly demandTypeOrder = computed(() => [...new Set(this.histories().map((history) => history.demandType))]
    .sort((first, second) => first.localeCompare(second, "pt-BR")));
  readonly visibleStatusOrder = computed(() => this.statusOrder().filter((status) => this.statusVisible(status)));
  readonly statusMetrics = computed(() => this.calculateStatusMetrics(this.events(), this.currentTime()));
  readonly activeByStatus = computed(() => {
    const current = this.currentTime();
    const lanes = new Map<string, ActiveDemand[]>();

    for (const history of this.histories()) {
      const event = history.events.find((item) => this.containsTimeline(item, current));
      if (!event) continue;

      const active = lanes.get(event.status) ?? [];
      active.push({ number: history.number, title: history.title, demandType: history.demandType, event, progress: this.eventProgress(event, current), events: history.events });
      lanes.set(event.status, active);
    }
    return lanes;
  });

  readonly visibleActiveByStatus = computed(() => {
    const visibleLanes = new Map<string, ActiveDemand[]>();
    for (const [status, items] of this.activeByStatus()) {
      visibleLanes.set(status, items.filter((item) => this.demandVisible(item.number) && this.demandTypeVisible(item.demandType)));
    }
    return visibleLanes;
  });

  readonly graph = computed<GraphView>(() => {
    const phases = this.visibleStatusOrder();
    const activeCounts = new Map(phases.map((status) => [status, this.visibleActiveByStatus().get(status)?.length ?? 0]));
    const maximumColumns = Math.max(1, Math.floor((GRAPH_WIDTH - (GRAPH_FLOW_PADDING * 2)) / GRAPH_PHASE_MIN_WIDTH));
    const levels = Math.ceil(phases.length / maximumColumns);
    const graphHeight = Math.max(GRAPH_MIN_HEIGHT, GRAPH_TOP_PADDING + GRAPH_BOTTOM_PADDING + Math.max(0, levels - 1) * GRAPH_LEVEL_GAP);
    const graphPhases = phases.map((status, index) => {
      const level = Math.floor(index / maximumColumns);
      const positionInLevel = index % maximumColumns;
      const phasesInLevel = Math.min(maximumColumns, phases.length - level * maximumColumns);
      const spacing = phasesInLevel < 2 ? 0 : (GRAPH_WIDTH - (GRAPH_FLOW_PADDING * 2)) / (phasesInLevel - 1);
      const column = level % 2 === 0 ? positionInLevel : phasesInLevel - 1 - positionInLevel;
      const x = phasesInLevel === 1 ? GRAPH_WIDTH / 2 : GRAPH_FLOW_PADDING + spacing * column;
      const activeCount = activeCounts.get(status) ?? 0;
      return {
        status,
        labelLines: this.graphLabelLines(status),
        color: this.graphPhaseLoadColor(activeCount, status),
        countColor: this.graphPhaseCountColor(activeCount),
        loadState: this.graphPhaseLoadState(activeCount, status),
        activeCount,
        x,
        y: GRAPH_TOP_PADDING + level * GRAPH_LEVEL_GAP,
      };
    });
    const phaseByStatus = new Map(graphPhases.map((phase) => [phase.status, phase]));
    const transitionCounts = this.graphTransitionCounts(phaseByStatus);
    const transitionColors = this.graphTransitionColors();

    const transitionRequests = [...transitionCounts.entries()].map(([key]) => {
      const [sourceStatus, targetStatus] = key.split("\u0000");
      return { key, source: phaseByStatus.get(sourceStatus)!, target: phaseByStatus.get(targetStatus)! };
    });
    const pointsByTransition = this.graphRoutingAlgorithm() === "optimized"
      ? this.graphOptimizedTransitionPoints(transitionRequests, graphPhases)
      : this.graphStandardTransitionPoints(transitionRequests, graphPhases);
    const transitions = transitionRequests.map(({ key, source, target }) => {
      const [sourceStatus, targetStatus] = key.split("\u0000");
      return {
        source: sourceStatus,
        target: targetStatus,
        color: transitionColors.get(key)!,
        count: transitionCounts.get(key)!,
        strokeWidth: GRAPH_TRANSITION_STROKE_WIDTH,
        activeDemandCount: 0,
        path: this.graphPath(pointsByTransition.get(key)!),
        points: pointsByTransition.get(key)!,
      };
    });
    this.separateGraphPorts(transitions, graphPhases, this.graphRoutingAlgorithm() === "optimized");
    const transitionByRoute = new Map(transitions.map((transition) => [`${transition.source}\u0000${transition.target}`, transition]));
    const demands = this.graphDemandNodes(phaseByStatus, transitionByRoute);
    const demandsByRoute = new Map<string, number>();
    for (const demand of demands) {
      const route = `${demand.source}\u0000${demand.target}`;
      demandsByRoute.set(route, (demandsByRoute.get(route) ?? 0) + 1);
    }
    for (const transition of transitions) {
      transition.activeDemandCount = demandsByRoute.get(`${transition.source}\u0000${transition.target}`) ?? 0;
    }
    return { height: graphHeight, phases: graphPhases, transitions, demands };
  });

  readonly activeCount = computed(() => [...this.visibleActiveByStatus().entries()]
    .filter(([status]) => this.statusVisible(status))
    .reduce((total, [, items]) => total + items.length, 0));
  readonly currentDate = computed(() => new Date(this.currentTime()));
  readonly sliderValue = computed(() => {
    const range = this.timelineEnd().getTime() - this.timelineStart().getTime();
    return range === 0 ? 0 : ((this.currentTime() - this.timelineStart().getTime()) / range) * 1000;
  });
  readonly sliderInputValue = computed(() => this.sliderValue() * (TIMELINE_SLIDER_MAXIMUM / 1000));
  readonly timelineChart = computed<TimelineChartView>(() => this.buildTimelineChart());
  async importSpreadsheet(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.loading.set(true);
    this.error.set("");
    this.pause();

    try {
      const parsed = await this.spreadsheetImporter.readFile(file);
      if (!parsed.length) throw new Error("Não encontrei linhas válidas para a simulação.");
      this.events.set(parsed);
      this.sourceName.set(file.name);
      this.currentTime.set(this.timelineStart().getTime());
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : "Não foi possível ler esta planilha.");
    } finally {
      this.loading.set(false);
      input.value = "";
    }
  }

  scrub(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    const start = this.timelineStart().getTime();
    const end = this.timelineEnd().getTime();
    this.pause();
    this.currentTime.set(start + ((end - start) * value) / TIMELINE_SLIDER_MAXIMUM);
  }

  togglePlayback(): void { this.playing() ? this.pause() : this.play(); }
  toggleTheme(): void { this.theme.update((theme) => theme === "light" ? "dark" : "light"); }
  setVisualization(format: VisualizationFormat): void { this.activeVisualization.set(format); }
  setDemandRepresentation(representation: DemandRepresentation): void { this.demandRepresentation.set(representation); }
  setGraphDemandRepresentation(representation: GraphDemandRepresentation): void { this.graphDemandRepresentation.set(representation); }
  setGraphRoutingAlgorithm(algorithm: GraphRoutingAlgorithm): void { this.graphRoutingAlgorithm.set(algorithm); }
  graphDemandLabelWidth(number: string): number { return Math.max(10, Math.min(36, 3 + number.length * 3.75)); }
  visibilityFilterExpanded(filter: VisibilityFilter): boolean { return this.expandedVisibilityFilters().has(filter); }
  toggleVisibilityFilter(filter: VisibilityFilter): void {
    this.expandedVisibilityFilters.update((filters) => {
      const next = new Set(filters);
      next.has(filter) ? next.delete(filter) : next.add(filter);
      return next;
    });
  }
  statusVisible(status: string): boolean { return !this.hiddenStatuses().has(status); }
  demandVisible(number: string): boolean { return !this.hiddenDemands().has(number); }
  demandTypeVisible(demandType: string): boolean { return !this.hiddenDemandTypes().has(demandType); }
  toggleStatusVisibility(status: string): void {
    this.hiddenStatuses.update((hidden) => {
      const next = new Set(hidden);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  }
  toggleDemandVisibility(number: string): void {
    this.hiddenDemands.update((hidden) => {
      const next = new Set(hidden);
      next.has(number) ? next.delete(number) : next.add(number);
      return next;
    });
  }
  toggleDemandTypeVisibility(demandType: string): void {
    this.hiddenDemandTypes.update((hidden) => {
      const next = new Set(hidden);
      next.has(demandType) ? next.delete(demandType) : next.add(demandType);
      return next;
    });
  }
  visibleStatusSummary(): string { return `${this.visibleStatusOrder().length} de ${this.statusOrder().length} visíveis`; }
  visibleDemandSummary(): string { return `${this.histories().filter((history) => this.demandVisible(history.number)).length} de ${this.histories().length} visíveis`; }
  visibleDemandTypeSummary(): string { return `${this.demandTypeOrder().filter((demandType) => this.demandTypeVisible(demandType)).length} de ${this.demandTypeOrder().length} visíveis`; }
  setSpeed(speed: number): void { this.speed.set(speed); }
  timelineLabel(): string {
    const date = this.currentDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    return date;
  }
  rangeLabel(date: Date): string { return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  cardDateLabel(date: Date): string { return `${date.getDate().toString().padStart(2, "0")}/${MONTH_ABBREVIATIONS[date.getMonth()]}`; }
  durationLabel(durationMs: number): string {
    const days = durationMs / 86_400_000;
    return `${days.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`;
  }

  demandTypeColor(demandType: string): string {
    const colors = ["#4f7fd8", "#bd7a18", "#178668", "#ba4d5c", "#6d54b1", "#0d7f95"];
    return colors[this.demandTypeOrder().indexOf(demandType) % colors.length] ?? colors[0];
  }
  laneColor(status: string): string {
    const colors = ["#6f77dc", "#d79b42", "#3aa888", "#d76370", "#4e91c7", "#8a6ec5"];
    return colors[this.statusOrder().indexOf(status) % colors.length] ?? colors[0];
  }
  graphPhaseLoadColor(activeCount: number, status = ""): string {
    const loadState = this.graphPhaseLoadState(activeCount, status);
    if (loadState === "overloaded") return "#7856a8";
    if (loadState === "critical") return "#c84e5b";
    if (loadState === "warning") return "#d39a39";
    const intensity = activeCount === 0 ? 0 : Math.sqrt(Math.min(activeCount, 3) / 3);
    const lightness = 88 - intensity * 37;
    return `hsl(215 10% ${lightness.toFixed(1)}%)`;
  }
  graphPhaseCountColor(activeCount: number): string {
    return activeCount === 3 || activeCount >= 6 ? "#f7f9fc" : "#354254";
  }
  graphPhaseLoadState(activeCount: number, status = ""): GraphPhaseLoadState {
    if (activeCount === 0) return "empty";
    if (this.graphPhaseMustStayNeutral(status)) return "neutral";
    if (activeCount >= 8) return "overloaded";
    if (activeCount >= 6) return "critical";
    if (activeCount >= 4) return "warning";
    return "neutral";
  }
  private graphPhaseMustStayNeutral(status: string): boolean {
    const normalized = status.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
    return GRAPH_ALWAYS_NEUTRAL_PHASES.has(normalized);
  }
  trackByNumber(_index: number, item: ActiveDemand): string { return item.number; }
  demandDurations(item: ActiveDemand): StatusDuration[] {
    const totals = new Map<string, number>();
    for (const event of item.events.filter((event) => event.startedAt.getTime() <= this.currentTime())) {
      totals.set(event.status, (totals.get(event.status) ?? 0) + this.eventDurationMs(event, this.currentTime()));
    }
    return [...totals.entries()].map(([status, durationMs]) => ({ status, durationMs }));
  }
  showDemandHint(event: Event, item: ActiveDemand): void {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const below = rect.top < 150;
    this.activeHint.set({
      item,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 248)),
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
    this.phaseHint.set(undefined);
  }
  hideDemandHint(): void { this.activeHint.set(undefined); }
  phaseHintItems(status: string): ActiveDemand[] { return this.visibleActiveByStatus().get(status) ?? []; }
  phaseHintId(status: string): string {
    const normalized = status.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, "-");
    return `phase-hint-${normalized}`;
  }
  showPhaseHint(event: Event, status: string): void {
    const node = event.currentTarget as Element;
    const rect = node.getBoundingClientRect();
    const below = rect.top < 150;
    this.phaseHint.set({
      status,
      items: this.phaseHintItems(status),
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 268)),
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    });
    this.activeHint.set(undefined);
  }
  hidePhaseHint(): void { this.phaseHint.set(undefined); }

  private play(): void {
    if (this.currentTime() >= this.timelineEnd().getTime()) this.currentTime.set(this.timelineStart().getTime());
    this.playing.set(true);
    this.lastFrame = undefined;
    this.animationFrame = requestAnimationFrame((time) => this.advance(time));
  }

  private pause(): void {
    this.playing.set(false);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = undefined;
    this.lastFrame = undefined;
  }

  private advance(frameTime: number): void {
    if (!this.playing()) return;
    if (this.lastFrame === undefined) this.lastFrame = frameTime;
    const elapsed = frameTime - this.lastFrame;
    const range = this.timelineEnd().getTime() - this.timelineStart().getTime();
    const next = this.currentTime() + (range * elapsed * this.speed()) / 45000;
    this.lastFrame = frameTime;
    if (next >= this.timelineEnd().getTime()) {
      this.currentTime.set(this.timelineEnd().getTime());
      this.pause();
      return;
    }
    this.currentTime.set(next);
    this.animationFrame = requestAnimationFrame((time) => this.advance(time));
  }

  parseRows(rows: Array<Record<string, unknown>>): DemandEvent[] { return this.spreadsheetImporter.parseRows(rows); }

  private dateOnly(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  timelineStart(): Date { return this.dateOnly(this.events().reduce((earliest, item) => item.startedAt < earliest ? item.startedAt : earliest, this.events()[0]?.startedAt ?? new Date())); }
  timelineEnd(): Date { return this.endOfDay(this.events().reduce((latest, item) => item.endedAt > latest ? item.endedAt : latest, this.events()[0]?.endedAt ?? new Date())); }

  private endOfDay(date: Date): Date { return new Date(this.dateOnly(date).getTime() + DAY_IN_MS - 1); }

  private buildTimelineChart(): TimelineChartView {
    const rangeStart = this.timelineStart().getTime();
    const rangeEnd = this.timelineEnd().getTime() + 1;
    const histories = this.histories().filter((history) => this.demandVisible(history.number) && this.demandTypeVisible(history.demandType));
    const boundaries = new Set<number>([rangeStart, rangeEnd]);
    const clampToRange = (time: number) => Math.max(rangeStart, Math.min(rangeEnd, time));

    for (const history of histories) {
      for (const event of history.events) {
        boundaries.add(clampToRange(event.timelineStartedAt.getTime()));
        boundaries.add(clampToRange(this.timelineChartEventEnd(event, rangeEnd)));
      }
    }

    const times = [...boundaries].sort((first, second) => first - second);
    const segments: TimelineChartSegment[] = [];
    for (let index = 0; index < times.length - 1; index += 1) {
      const start = times[index];
      const end = times[index + 1];
      if (end <= start) continue;
      const sample = start + (end - start) / 2;
      let total = 0;

      for (const history of histories) {
        // Intervalos semiabertos evitam contar duas situações da mesma demanda
        // exatamente no ponto em que ocorre uma transição.
        const event = history.events.find((item) => sample >= item.timelineStartedAt.getTime() && sample < this.timelineChartEventEnd(item, rangeEnd));
        if (event && TIMELINE_CHART_STATUS_KEYS.has(timelineChartStatusKey(event.status))) total += 1;
      }
      segments.push({ start, end, total });
    }

    const maximum = Math.max(0, ...segments.map((segment) => segment.total));
    const scaleMaximum = Math.max(1, maximum);
    const chartX = (time: number) => ((time - rangeStart) / Math.max(1, rangeEnd - rangeStart)) * TIMELINE_CHART_WIDTH;
    const chartY = (count: number) => TIMELINE_CHART_BASELINE - (count / scaleMaximum) * (TIMELINE_CHART_BASELINE - TIMELINE_CHART_TOP);
    const point = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`;
    const linePoints = segments.flatMap((segment) => [
      point(chartX(segment.start), chartY(segment.total)),
      point(chartX(segment.end), chartY(segment.total)),
    ]).join(" ");
    const areaBasePoints = [...segments].reverse().flatMap((segment) => [
      point(chartX(segment.end), TIMELINE_CHART_BASELINE),
      point(chartX(segment.start), TIMELINE_CHART_BASELINE),
    ]).join(" ");
    const peakSegments = segments.filter((segment) => segment.total === maximum);
    const peakSegment = peakSegments.reduce(
      (longest, segment) => segment.end - segment.start > longest.end - longest.start ? segment : longest,
      peakSegments[0],
    );
    const peakTime = peakSegment ? peakSegment.start + (peakSegment.end - peakSegment.start) / 2 : rangeStart;

    return {
      width: TIMELINE_CHART_WIDTH,
      height: TIMELINE_CHART_HEIGHT,
      baseline: TIMELINE_CHART_BASELINE,
      maximum,
      statuses: [...TIMELINE_CHART_STATUSES],
      areaPoints: `${linePoints} ${areaBasePoints}`,
      linePoints,
      peak: { count: maximum, time: peakTime, x: chartX(peakTime), y: chartY(maximum) },
    };
  }

  private timelineChartEventEnd(event: TimelineEvent, rangeEnd: number): number {
    if (!event.usesLogicalTime) return event.timelineEndedAt.getTime() + DAY_IN_MS;
    return event.timelineEndedAt.getTime() >= rangeEnd - 1 ? rangeEnd : event.timelineEndedAt.getTime();
  }

  private createTimelineEvents(events: DemandEvent[]): TimelineEvent[] {
    const eventsByStart = new Map<number, DemandEvent[]>();
    for (const event of events) {
      const sameDay = eventsByStart.get(event.startedAt.getTime()) ?? [];
      sameDay.push(event);
      eventsByStart.set(event.startedAt.getTime(), sameDay);
    }

    const timelineStarts = new Map<DemandEvent, Date>();
    for (const [startedAt, sameDay] of eventsByStart) {
      const step = DAY_IN_MS / sameDay.length;
      sameDay.forEach((event, index) => timelineStarts.set(event, new Date(startedAt + step * index)));
    }

    return events.map((event, index) => {
      const next = events[index + 1];
      const timelineStartedAt = timelineStarts.get(event)!;
      const hasSameDaySequence = (eventsByStart.get(event.startedAt.getTime())?.length ?? 0) > 1;
      const nextStartsBeforeOrOnEnd = next && next.startedAt.getTime() <= event.endedAt.getTime();
      const usesLogicalTime = hasSameDaySequence || Boolean(nextStartsBeforeOrOnEnd);
      const timelineEndedAt = nextStartsBeforeOrOnEnd
        ? timelineStarts.get(next)!
        : usesLogicalTime ? this.endOfDay(event.endedAt) : event.endedAt;
      return { ...event, timelineStartedAt, timelineEndedAt, hasSameDaySequence, usesLogicalTime };
    });
  }

  // A posição média resolve fluxos com bifurcações; transições diretas mais frequentes
  // desempata pares de situações que aparecem na mesma posição média.
  private inferStatusOrder(histories: DemandHistory[]): string[] {
    const position = new Map<string, { total: number; count: number; first: number }>();
    const edges = new Map<string, number>();
    let ordinal = 0;
    for (const history of histories) {
      history.events.forEach((event, index) => {
        const current = position.get(event.status) ?? { total: 0, count: 0, first: ordinal++ };
        current.total += index;
        current.count += 1;
        position.set(event.status, current);
        const next = history.events[index + 1];
        if (next && next.status !== event.status) {
          const key = `${event.status}\u0000${next.status}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      });
    }
    return [...position.keys()].sort((first, second) => {
      const firstData = position.get(first)!;
      const secondData = position.get(second)!;
      const forward = edges.get(`${first}\u0000${second}`) ?? 0;
      const backward = edges.get(`${second}\u0000${first}`) ?? 0;
      if (forward !== backward) return backward - forward;
      const firstAverage = firstData.total / firstData.count;
      const secondAverage = secondData.total / secondData.count;
      return firstAverage - secondAverage || firstData.first - secondData.first || first.localeCompare(second, "pt-BR");
    });
  }

  // Cada passo considera apenas intervalos que já começaram. Para uma demanda
  // ainda em andamento, o fim do intervalo é o instante selecionado na linha do tempo.
  private calculateStatusMetrics(events: DemandEvent[], asOf: number): Map<string, StatusMetrics> {
    const eventsByStatus = new Map<string, DemandEvent[]>();
    for (const event of events.filter((item) => item.startedAt.getTime() <= asOf)) {
      const items = eventsByStatus.get(event.status) ?? [];
      items.push(event);
      eventsByStatus.set(event.status, items);
    }

    const metrics = new Map<string, StatusMetrics>();
    for (const [status, items] of eventsByStatus) {
      const durations = items.map((item) => this.eventDurationMs(item, asOf)).sort((first, second) => first - second);
      metrics.set(status, {
        maxConcurrent: this.maxConcurrent(items, asOf),
        averageMs: durations.reduce((total, duration) => total + duration, 0) / durations.length,
        p90Ms: this.percentile(durations, 0.9),
        p95Ms: this.percentile(durations, 0.95),
      });
    }
    return metrics;
  }

  private maxConcurrent(events: DemandEvent[], asOf: number): number {
    const boundaries = events.flatMap((event) => [
      { time: event.startedAt.getTime(), change: 1 },
      { time: Math.min(event.endedAt.getTime(), asOf) + 86_400_000, change: -1 },
    ]).sort((first, second) => first.time - second.time || second.change - first.change);
    let current = 0;
    let maximum = 0;
    for (const boundary of boundaries) {
      current += boundary.change;
      maximum = Math.max(maximum, current);
    }
    return maximum;
  }

  private percentile(sortedValues: number[], fraction: number): number {
    return sortedValues[Math.max(0, Math.ceil(sortedValues.length * fraction) - 1)] ?? 0;
  }

  private eventDurationMs(event: DemandEvent, asOf = Number.POSITIVE_INFINITY): number {
    return Math.min(event.endedAt.getTime(), asOf) - event.startedAt.getTime() + 86_400_000;
  }
  private eventProgress(event: TimelineEvent, time: number): number {
    return this.periodProgress(event.timelineStartedAt, event.timelineEndedAt, time);
  }
  private containsTimeline(visit: Pick<PhaseVisit, "startedAt" | "endedAt"> | TimelineEvent, time: number): boolean {
    const startedAt = "timelineStartedAt" in visit ? visit.timelineStartedAt : visit.startedAt;
    const endedAt = "timelineEndedAt" in visit ? visit.timelineEndedAt : visit.endedAt;
    const usesLogicalTime = "usesLogicalTime" in visit && visit.usesLogicalTime;
    return time >= startedAt.getTime() && time <= endedAt.getTime() + (usesLogicalTime ? 0 : DAY_IN_MS - 1);
  }
  private periodProgress(startedAt: Date, endedAt: Date, time: number): number {
    const length = Math.max(endedAt.getTime() - startedAt.getTime(), 1);
    return Math.min(100, Math.max(0, ((time - startedAt.getTime()) / length) * 100));
  }
  private graphTransitionCounts(phaseByStatus: Map<string, GraphPhaseNode>): Map<string, number> {
    const transitionCounts = new Map<string, number>();
    for (const history of this.histories()) {
      const visits = this.phaseVisits(history.events);
      for (let index = 0; index < visits.length - 1; index += 1) {
        const source = visits[index];
        const target = visits[index + 1];
        if (!phaseByStatus.has(source.status) || !phaseByStatus.has(target.status)) continue;
        const key = `${source.status}\u0000${target.status}`;
        transitionCounts.set(key, (transitionCounts.get(key) ?? 0) + 1);
      }
    }
    return transitionCounts;
  }
  private graphDemandNodes(phaseByStatus: Map<string, GraphPhaseNode>, transitionByRoute: Map<string, GraphTransition>): GraphDemandNode[] {
    const demands: GraphDemandNode[] = [];
    const current = this.currentTime();
    const laneOffsets = this.graphDemandLaneOffsetsByTraversal();

    for (const history of this.histories()) {
      if (!this.demandVisible(history.number) || !this.demandTypeVisible(history.demandType)) continue;
      const visits = this.phaseVisits(history.events);
      const visitIndex = visits.findIndex((visit) => this.containsTimeline(visit, current));
      if (visitIndex < 0) continue;
      const source = visits[visitIndex];
      const target = visits[visitIndex + 1];
      const sourcePhase = phaseByStatus.get(source.status);
      const targetPhase = target ? phaseByStatus.get(target.status) : undefined;
      if (!sourcePhase) continue;
      const event = history.events.find((item) => this.containsTimeline(item, current));
      if (!event) continue;
      const item: ActiveDemand = {
        number: history.number,
        title: history.title,
        demandType: history.demandType,
        event,
        progress: this.eventProgress(event, current),
        events: history.events,
      };
      const transition = target ? transitionByRoute.get(`${source.status}\u0000${target.status}`) : undefined;

      if (target && targetPhase && transition) {
        demands.push({
          number: history.number,
          title: history.title,
          demandType: history.demandType,
          item,
          color: this.demandTypeColor(history.demandType),
          routeColor: transition.color,
          source: source.status,
          target: target.status,
          progress: this.periodProgress(source.startedAt, source.endedAt, current),
          laneOffset: laneOffsets.get(this.graphRouteTraversalKey(history.number, source, target)) ?? 0,
          x: 0,
          y: 0,
        });
      }
    }

    const demandsByRoute = new Map<string, GraphDemandNode[]>();
    for (const demand of demands) {
      const route = `${demand.source}\u0000${demand.target}`;
      const atRoute = demandsByRoute.get(route) ?? [];
      atRoute.push(demand);
      demandsByRoute.set(route, atRoute);
    }
    for (const [route, demandsAtRoute] of demandsByRoute) {
      const transition = transitionByRoute.get(route)!;
      for (const demand of demandsAtRoute) {
        const { point, normal } = this.graphRoutePosition(transition.points, demand.progress);
        demand.x = point.x + normal.x * demand.laneOffset;
        demand.y = point.y + normal.y * demand.laneOffset;
      }
    }
    return demands;
  }
  // Faixas são definidas na entrada da ligação. Uma demanda posterior só sai do
  // corredor central se sua velocidade permitir que alcance outra já em trânsito.
  private graphDemandLaneOffsetsByTraversal(): Map<string, number> {
    const traversalsByRoute = new Map<string, GraphRouteTraversal[]>();
    for (const history of this.histories()) {
      const visits = this.phaseVisits(history.events);
      for (let index = 0; index < visits.length - 1; index += 1) {
        const source = visits[index];
        const target = visits[index + 1];
        const route = `${source.status}\u0000${target.status}`;
        const traversals = traversalsByRoute.get(route) ?? [];
        traversals.push({
          key: this.graphRouteTraversalKey(history.number, source, target),
          route,
          startedAt: source.startedAt,
          endedAt: source.endedAt,
        });
        traversalsByRoute.set(route, traversals);
      }
    }

    const offsets = new Map<string, number>();
    for (const traversals of traversalsByRoute.values()) {
      const assigned: Array<{ traversal: GraphRouteTraversal; offset: number }> = [];
      for (const traversal of traversals.sort((first, second) => first.startedAt.getTime() - second.startedAt.getTime()
        || first.endedAt.getTime() - second.endedAt.getTime() || first.key.localeCompare(second.key, "pt-BR"))) {
        const occupiedOffsets = new Set(assigned
          .filter((previous) => this.graphRouteTraversalsMeet(traversal, previous.traversal))
          .map((previous) => previous.offset));
        const offset = this.graphAvailableDemandLane(occupiedOffsets);
        offsets.set(traversal.key, offset);
        assigned.push({ traversal, offset });
      }
    }
    return offsets;
  }
  private graphRouteTraversalKey(number: string, source: PhaseVisit, target: PhaseVisit): string {
    return `${number}\u0000${source.status}\u0000${target.status}\u0000${source.startedAt.getTime()}`;
  }
  private graphRouteTraversalsMeet(first: GraphRouteTraversal, second: GraphRouteTraversal): boolean {
    const startedAt = Math.max(first.startedAt.getTime(), second.startedAt.getTime());
    const endedAt = Math.min(first.endedAt.getTime(), second.endedAt.getTime());
    if (startedAt > endedAt) return false;
    const progressDifference = (time: number) => this.periodProgress(first.startedAt, first.endedAt, time)
      - this.periodProgress(second.startedAt, second.endedAt, time);
    const atStart = progressDifference(startedAt);
    const atEnd = progressDifference(endedAt);
    return atStart === 0 || atEnd === 0 || atStart * atEnd < 0;
  }
  private graphAvailableDemandLane(occupiedOffsets: Set<number>): number {
    return this.graphDemandLaneOffsets(occupiedOffsets.size + 1).find((offset) => !occupiedOffsets.has(offset)) ?? 0;
  }
  // A cor pertence ao par origem-destino, e não à quantidade de demandas na rota.
  // Assim, ela continua a mesma durante a reprodução e após filtros temporários.
  private graphTransitionColors(): Map<string, string> {
    const routes = new Set<string>();
    for (const history of this.histories()) {
      const visits = this.phaseVisits(history.events);
      for (let index = 0; index < visits.length - 1; index += 1) {
        routes.add(`${visits[index].status}\u0000${visits[index + 1].status}`);
      }
    }

    const occupiedHues = new Set<number>();
    return new Map([...routes].sort((first, second) => first.localeCompare(second, "pt-BR")).map((route) => {
      let hue = this.graphRouteColorHash(route) % 360;
      while (occupiedHues.has(hue)) hue = (hue + 47) % 360;
      occupiedHues.add(hue);
      return [route, `hsl(${hue} 68% 42%)`];
    }));
  }
  private graphRouteColorHash(route: string): number {
    let hash = 0;
    for (const character of route) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return hash;
  }
  // Rotas diretas são preferidas. Trechos horizontais ficam fora da faixa visual
  // dos nós; entre níveis, o espaço central recebe corredores paralelos.
  // A rota externa permanece como garantia para casos densos.
  private graphStandardTransitionPoints(requests: GraphRouteRequest[], phases: GraphPhaseNode[]): Map<string, GraphPoint[]> {
    const pointsByTransition = new Map<string, GraphPoint[]>();
    const occupiedRoutes: GraphPoint[][] = [];
    for (const request of requests) {
      const points = this.graphTransitionPoints(request.source, request.target, phases, occupiedRoutes);
      pointsByTransition.set(request.key, points);
      occupiedRoutes.push(points);
    }
    return pointsByTransition;
  }
  // O modo otimizado preserva as fases e procura rotas como um conjunto. Primeiro
  // fixa as ligações mais longas e, em seguida, revisa cada decisão contra todas
  // as demais, evitando que a ordem de leitura da planilha determine o resultado.
  private graphOptimizedTransitionPoints(requests: GraphRouteRequest[], phases: GraphPhaseNode[]): Map<string, GraphPoint[]> {
    const candidatesByTransition = new Map(requests.map((request) => [
      request.key,
      this.graphOptimizedCandidates(request.source, request.target, phases),
    ]));
    const routeLength = (request: GraphRouteRequest) => Math.hypot(request.target.x - request.source.x, request.target.y - request.source.y);
    const routeOrder = [...requests].sort((first, second) => routeLength(second) - routeLength(first) || first.key.localeCompare(second.key, "pt-BR"));
    const pointsByTransition = new Map<string, GraphPoint[]>();

    for (const request of routeOrder) {
      const occupiedRoutes = [...pointsByTransition.values()];
      pointsByTransition.set(request.key, this.graphOptimizedRoute(
        candidatesByTransition.get(request.key)!, occupiedRoutes, request.source, request.target,
      ));
    }

    for (let pass = 0; pass < GRAPH_OPTIMIZATION_PASSES; pass += 1) {
      for (const request of routeOrder) {
        const occupiedRoutes = [...pointsByTransition.entries()]
          .filter(([key]) => key !== request.key)
          .map(([, points]) => points);
        pointsByTransition.set(request.key, this.graphOptimizedRoute(
          candidatesByTransition.get(request.key)!, occupiedRoutes, request.source, request.target,
        ));
      }
    }
    return pointsByTransition;
  }
  private graphOptimizedCandidates(source: GraphPhaseNode, target: GraphPhaseNode, phases: GraphPhaseNode[]): GraphPoint[][] {
    const fallback = this.graphRouteEndpoints([{ x: source.x, y: source.y }, { x: target.x, y: target.y }], source, target);
    const routesByPath = new Map<string, GraphPoint[]>();
    for (const points of this.graphRouteCandidates(source, target, phases)) routesByPath.set(this.graphPath(points), points);
    if (routesByPath.size === 0) routesByPath.set(this.graphPath(fallback), fallback);

    const ranked = [...routesByPath.values()].sort((first, second) => this.graphRouteScore(first, [], source, target) - this.graphRouteScore(second, [], source, target)
      || this.graphPath(first).localeCompare(this.graphPath(second), "pt-BR"));
    const lowerEdge = Math.max(source.y, target.y);
    const upperRoutes = ranked.filter((points) => !points.some((point) => point.y > lowerEdge));
    const lowerRoutes = ranked.filter((points) => points.some((point) => point.y > lowerEdge));
    return [
      ...upperRoutes.slice(0, GRAPH_OPTIMIZED_ROUTE_CANDIDATES_PER_SIDE),
      ...lowerRoutes.slice(0, GRAPH_OPTIMIZED_ROUTE_CANDIDATES_PER_SIDE),
    ];
  }
  private graphOptimizedRoute(candidates: GraphPoint[][], occupiedRoutes: GraphPoint[][], source: GraphPhaseNode, target: GraphPhaseNode): GraphPoint[] {
    return candidates.reduce((best, candidate) => {
      const candidateScore = this.graphOptimizedRouteScore(candidate, occupiedRoutes, source, target);
      const bestScore = this.graphOptimizedRouteScore(best, occupiedRoutes, source, target);
      if (candidateScore !== bestScore) return candidateScore < bestScore ? candidate : best;
      return this.graphPath(candidate).localeCompare(this.graphPath(best), "pt-BR") < 0 ? candidate : best;
    });
  }
  private graphOptimizedRouteScore(points: GraphPoint[], occupiedRoutes: GraphPoint[][], source: GraphPhaseNode, target: GraphPhaseNode): number {
    return this.graphRouteScore(points, occupiedRoutes, source, target)
      + this.graphRouteCrossingPenalty(points, occupiedRoutes)
      + this.graphRouteOverlapPenalty(points, occupiedRoutes);
  }
  // No modo otimizado, uma linha sobre outra é pior que um cruzamento: o traço
  // inteiro deixa de ser distinguível. Esta medição inclui todos os segmentos,
  // inclusive os próximos às portas que o roteador padrão não pontua.
  private graphRouteOverlapPenalty(points: GraphPoint[], occupiedRoutes: GraphPoint[][]): number {
    let overlapCount = 0;
    let overlapLength = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const occupied of occupiedRoutes) {
        for (let occupiedIndex = 0; occupiedIndex < occupied.length - 1; occupiedIndex += 1) {
          const length = this.graphOrthogonalSegmentOverlapLength(points[index], points[index + 1], occupied[occupiedIndex], occupied[occupiedIndex + 1]);
          if (length === 0) continue;
          overlapCount += 1;
          overlapLength += length;
        }
      }
    }
    return overlapCount * GRAPH_OPTIMIZED_ROUTE_OVERLAP_PENALTY + overlapLength;
  }
  private graphOrthogonalSegmentOverlapLength(firstStart: GraphPoint, firstEnd: GraphPoint, secondStart: GraphPoint, secondEnd: GraphPoint): number {
    const horizontal = firstStart.y === firstEnd.y && secondStart.y === secondEnd.y && firstStart.y === secondStart.y;
    const vertical = firstStart.x === firstEnd.x && secondStart.x === secondEnd.x && firstStart.x === secondStart.x;
    if (!horizontal && !vertical) return 0;
    const firstRange = horizontal ? [firstStart.x, firstEnd.x] : [firstStart.y, firstEnd.y];
    const secondRange = horizontal ? [secondStart.x, secondEnd.x] : [secondStart.y, secondEnd.y];
    return Math.max(0, Math.min(Math.max(...firstRange), Math.max(...secondRange)) - Math.max(Math.min(...firstRange), Math.min(...secondRange)));
  }
  private graphRouteCrossingPenalty(points: GraphPoint[], occupiedRoutes: GraphPoint[][]): number {
    let crossings = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const occupied of occupiedRoutes) {
        for (let occupiedIndex = 0; occupiedIndex < occupied.length - 1; occupiedIndex += 1) {
          if (this.graphSegmentsProperlyIntersect(points[index], points[index + 1], occupied[occupiedIndex], occupied[occupiedIndex + 1])) crossings += 1;
        }
      }
    }
    return crossings * GRAPH_ROUTE_CROSSING_PENALTY;
  }
  private graphSegmentsProperlyIntersect(firstStart: GraphPoint, firstEnd: GraphPoint, secondStart: GraphPoint, secondEnd: GraphPoint): boolean {
    const orientation = (start: GraphPoint, end: GraphPoint, point: GraphPoint) =>
      (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
    const firstStartSide = orientation(firstStart, firstEnd, secondStart);
    const firstEndSide = orientation(firstStart, firstEnd, secondEnd);
    const secondStartSide = orientation(secondStart, secondEnd, firstStart);
    const secondEndSide = orientation(secondStart, secondEnd, firstEnd);
    return firstStartSide * firstEndSide < 0 && secondStartSide * secondEndSide < 0;
  }
  private graphTransitionPoints(source: GraphPhaseNode, target: GraphPhaseNode, phases: GraphPhaseNode[], occupiedRoutes: GraphPoint[][]): GraphPoint[] {
    const routes = this.graphRouteCandidates(source, target, phases)
      .sort((first, second) => this.graphRouteScore(first, occupiedRoutes, source, target) - this.graphRouteScore(second, occupiedRoutes, source, target));

    return routes[0] ?? this.graphRouteEndpoints([{ x: source.x, y: source.y }, { x: target.x, y: target.y }], source, target);
  }
  private graphRouteCandidates(source: GraphPhaseNode, target: GraphPhaseNode, phases: GraphPhaseNode[]): GraphPoint[][] {
    const sourceCenter = { x: source.x, y: source.y };
    const targetCenter = { x: target.x, y: target.y };
    const clearance = GRAPH_PHASE_RADIUS + GRAPH_ROUTE_CLEARANCE;
    const phaseXs = phases.map((phase) => phase.x);
    const phaseYs = phases.map((phase) => phase.y);
    const yChannels = this.graphRouteChannels(phaseYs, clearance, GRAPH_HORIZONTAL_ROUTE_CLEARANCE);
    const xChannels = this.graphRouteChannels(phaseXs, clearance);
    const candidates: GraphPoint[][] = [
      [sourceCenter, targetCenter],
      [sourceCenter, { x: source.x, y: target.y }, targetCenter],
      [sourceCenter, { x: target.x, y: source.y }, targetCenter],
    ];

    for (const y of yChannels) candidates.push([sourceCenter, { x: source.x, y }, { x: target.x, y }, targetCenter]);
    for (const x of xChannels) candidates.push([sourceCenter, { x, y: source.y }, { x, y: target.y }, targetCenter]);

    const outerXs = [Math.min(...phaseXs) - clearance, Math.max(...phaseXs) + clearance];
    for (const outerX of outerXs) {
      for (const sourceDirection of [-1, 1]) {
        for (const targetDirection of [-1, 1]) {
          const sourceY = source.y + GRAPH_HORIZONTAL_ROUTE_CLEARANCE * sourceDirection;
          const targetY = target.y + GRAPH_HORIZONTAL_ROUTE_CLEARANCE * targetDirection;
          candidates.push([
            sourceCenter,
            { x: source.x, y: sourceY },
            { x: outerX, y: sourceY },
            { x: outerX, y: targetY },
            { x: target.x, y: targetY },
            targetCenter,
          ]);
        }
      }
    }

    return candidates
      .map((candidate) => this.graphRouteEndpoints(candidate, source, target))
      .filter((points) => this.graphRouteClearsPhases(points, phases, new Set([source.status, target.status]))
        && this.graphRouteClearsHorizontalPhaseBands(points, phases, new Set([source.status, target.status])));
  }
  private graphRouteChannels(coordinates: number[], clearance: number, outerClearance = clearance): number[] {
    const sorted = [...new Set(coordinates)].sort((first, second) => first - second);
    const channels = [sorted[0] - outerClearance, sorted.at(-1)! + outerClearance];
    for (const coordinate of sorted) channels.push(coordinate - clearance, coordinate + clearance);
    for (let index = 0; index < sorted.length - 1; index += 1) channels.push((sorted[index] + sorted[index + 1]) / 2);
    const laneOffsets = [0];
    for (let level = 1; level <= GRAPH_ROUTE_CHANNEL_LEVELS; level += 1) {
      laneOffsets.push(-level * GRAPH_ROUTE_SEPARATION, level * GRAPH_ROUTE_SEPARATION);
    }
    return [...new Set(channels.flatMap((channel) => laneOffsets.map((offset) => channel + offset)))];
  }
  private graphRouteEndpoints(candidate: GraphPoint[], source: GraphPhaseNode, target: GraphPhaseNode): GraphPoint[] {
    const centers = this.graphSimplifyPoints(candidate);
    const firstDirection = this.graphDirection(centers[0], centers[1]);
    const lastDirection = this.graphDirection(centers.at(-1)!, centers.at(-2)!);
    return this.graphSimplifyPoints([
      { x: source.x + firstDirection.x * GRAPH_PHASE_RADIUS, y: source.y + firstDirection.y * GRAPH_PHASE_RADIUS },
      ...centers.slice(1, -1),
      { x: target.x + lastDirection.x * GRAPH_PHASE_RADIUS, y: target.y + lastDirection.y * GRAPH_PHASE_RADIUS },
    ]);
  }
  private separateGraphPorts(transitions: GraphTransition[], phases: GraphPhaseNode[], separateElbowLanes = false): void {
    const phaseByStatus = new Map(phases.map((phase) => [phase.status, phase]));
    const ports: GraphPhasePort[] = [];

    for (const transition of transitions) {
      const source = phaseByStatus.get(transition.source);
      const target = phaseByStatus.get(transition.target);
      if (source) ports.push({ transition, pointIndex: 0, phase: source, kind: "outgoing", side: this.graphPortSide(transition.points[0], source) });
      if (target) {
        const pointIndex = transition.points.length - 1;
        ports.push({ transition, pointIndex, phase: target, kind: "incoming", side: this.graphPortSide(transition.points[pointIndex], target) });
      }
    }

    const portsBySide = new Map<string, GraphPhasePort[]>();
    for (const port of ports) {
      const key = `${port.phase.status}\u0000${port.side}`;
      const atSide = portsBySide.get(key) ?? [];
      atSide.push(port);
      portsBySide.set(key, atSide);
    }

    for (const portsAtSide of portsBySide.values()) {
      if (portsAtSide.length < 2) continue;
      const availablePortWidth = GRAPH_PHASE_RADIUS * 2 - GRAPH_PHASE_PORT_SEPARATION;
      const separation = Math.min(GRAPH_PHASE_PORT_SEPARATION, availablePortWidth / Math.max(1, portsAtSide.length - 1));
      const orderedPorts = this.graphPortOrder(portsAtSide);
      const directPort = orderedPorts.find((port) => this.graphTransitionCanRemainStraight(port.transition, transitions));
      if (directPort) {
        this.separateGraphPortsAroundDirectRoute(orderedPorts, directPort, separation);
      } else {
        orderedPorts.forEach((port, index) => {
          this.positionGraphPort(port, (index - (orderedPorts.length - 1) / 2) * separation);
        });
      }
    }

    // A mudança lateral ocorre somente perto da borda do nó. Usar o ponto
    // anterior da rota como cotovelo faria uma ligação longa ganhar um degrau
    // reto distante da fase.
    const elbows = ports
      .filter((port) => port.offset !== undefined)
      .map((port) => ({
        port,
        points: this.graphPortElbows(port, port.kind === "outgoing" ? port.transition.points[1] : port.transition.points.at(-2)!, separateElbowLanes),
      }));
    for (const { port, points } of elbows.filter(({ port }) => port.kind === "outgoing")) {
      port.transition.points.splice(1, 0, ...points);
    }
    for (const { port, points } of elbows.filter(({ port }) => port.kind === "incoming")) {
      port.transition.points.splice(-1, 0, ...points);
    }

    transitions.forEach((transition) => {
      transition.points = this.graphSimplifyPoints(transition.points);
      transition.path = this.graphPath(transition.points);
    });
  }
  // Uma reta desimpedida é a leitura mais clara entre fases vizinhas. As outras
  // ligações ainda recebem portas próprias ao redor dela quando compartilham a face.
  private separateGraphPortsAroundDirectRoute(ports: GraphPhasePort[], directPort: GraphPhasePort, separation: number): void {
    const directIndex = ports.indexOf(directPort);
    let before = 0;
    let after = 0;
    ports.forEach((port, index) => {
      if (port === directPort) return;
      const offset = index < directIndex ? -(++before) * separation : (++after) * separation;
      this.positionGraphPort(port, offset);
    });
  }
  private graphTransitionCanRemainStraight(transition: GraphTransition, transitions: GraphTransition[]): boolean {
    if (transition.points.length !== 2) return false;
    return !transitions.some((other) => other !== transition && this.graphTransitionsShareMainLane(transition, other));
  }
  private graphTransitionsShareMainLane(first: GraphTransition, second: GraphTransition): boolean {
    if (first.source === second.target && first.target === second.source) return true;
    for (let firstIndex = 0; firstIndex < first.points.length - 1; firstIndex += 1) {
      for (let secondIndex = 0; secondIndex < second.points.length - 1; secondIndex += 1) {
        const lane = this.graphSharedLane(first.points[firstIndex], first.points[firstIndex + 1], second.points[secondIndex], second.points[secondIndex + 1]);
        if (lane?.separation === 0) return true;
      }
    }
    return false;
  }
  private graphPortSide(point: GraphPoint, phase: GraphPhaseNode): GraphPortSide {
    const horizontalDistance = point.x - phase.x;
    const verticalDistance = point.y - phase.y;
    if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) return horizontalDistance < 0 ? "left" : "right";
    return verticalDistance < 0 ? "top" : "bottom";
  }
  private graphPortOrder(ports: GraphPhasePort[]): GraphPhasePort[] {
    const approachCoordinate = (port: GraphPhasePort) => {
      const adjacent = port.kind === "outgoing" ? port.transition.points[1] : port.transition.points.at(-2)!;
      return port.side === "top" || port.side === "bottom" ? adjacent.x : adjacent.y;
    };
    return [...ports].sort((first, second) =>
      approachCoordinate(first) - approachCoordinate(second)
      || first.transition.source.localeCompare(second.transition.source)
      || first.transition.target.localeCompare(second.transition.target),
    );
  }
  private positionGraphPort(port: GraphPhasePort, offset: number): void {
    const point = port.transition.points[port.pointIndex];
    port.offset = offset;
    if (port.side === "top" || port.side === "bottom") {
      point.x = port.phase.x + offset;
      point.y = port.phase.y + (port.side === "top" ? -GRAPH_PHASE_RADIUS : GRAPH_PHASE_RADIUS);
      return;
    }
    point.x = port.phase.x + (port.side === "left" ? -GRAPH_PHASE_RADIUS : GRAPH_PHASE_RADIUS);
    point.y = port.phase.y + offset;
  }
  private graphPortElbows(port: GraphPhasePort, adjacent: GraphPoint, separateElbowLanes: boolean): GraphPoint[] {
    const point = port.transition.points[port.pointIndex];
    if (port.side === "top" || port.side === "bottom") {
      // Deslocar a rota no próprio corredor mantém a chegada vertical e elimina
      // os pequenos ganchos que se cruzavam imediatamente acima do nó.
      return [{ x: point.x, y: adjacent.y }];
    }
    const direction = port.side === "left" ? -1 : 1;
    // O modo otimizado leva cada porta lateral a uma faixa externa própria.
    // Sem isso, os cotovelos de portas com alturas distintas ainda poderiam
    // compartilhar o mesmo segmento vertical longo após o roteamento.
    const laneDistance = separateElbowLanes
      ? GRAPH_PHASE_PORT_ELBOW_DISTANCE + GRAPH_PHASE_RADIUS + (port.offset ?? 0)
      : GRAPH_PHASE_PORT_ELBOW_DISTANCE;
    const x = point.x + direction * laneDistance;
    const elbows = [{ x, y: adjacent.y }, { x, y: point.y }];
    return port.kind === "outgoing" ? elbows.reverse() : elbows;
  }
  private graphSimplifyPoints(points: GraphPoint[]): GraphPoint[] {
    const simplified: GraphPoint[] = [];
    for (const point of points) {
      const previous = simplified.at(-1);
      if (previous && previous.x === point.x && previous.y === point.y) continue;
      const beforePrevious = simplified.at(-2);
      if (beforePrevious && previous && ((beforePrevious.x === previous.x && previous.x === point.x) || (beforePrevious.y === previous.y && previous.y === point.y))) {
        simplified[simplified.length - 1] = point;
      } else {
        simplified.push(point);
      }
    }
    return simplified;
  }
  private graphDirection(from: GraphPoint, to: GraphPoint): GraphPoint {
    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
  }
  private graphRouteClearsPhases(points: GraphPoint[], phases: GraphPhaseNode[], excludedStatuses: Set<string>, phaseRadius = GRAPH_PHASE_RADIUS): boolean {
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const phase of phases) {
        if (excludedStatuses.has(phase.status)) continue;
        if (this.graphDistanceToSegment({ x: phase.x, y: phase.y }, points[index], points[index + 1]) < phaseRadius + GRAPH_ROUTE_CLEARANCE) return false;
      }
    }
    return true;
  }
  private graphRouteClearsHorizontalPhaseBands(points: GraphPoint[], phases: GraphPhaseNode[], terminalStatuses: Set<string>): boolean {
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      if (start.y !== end.y) continue;
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      for (const phase of phases) {
        if (phase.x < left || phase.x > right) continue;
        // Uma ligação direta entre vizinhos pode seguir a mesma fileira dos
        // próprios terminais. Qualquer outro trecho horizontal precisa usar
        // um corredor fora da faixa reservada aos nós.
        if (terminalStatuses.has(phase.status) && phase.y === start.y) continue;
        if (Math.abs(phase.y - start.y) < GRAPH_HORIZONTAL_ROUTE_CLEARANCE) return false;
      }
    }
    return true;
  }
  private graphDistanceToSegment(point: GraphPoint, start: GraphPoint, end: GraphPoint): number {
    const horizontal = end.x - start.x;
    const vertical = end.y - start.y;
    const squaredLength = horizontal ** 2 + vertical ** 2;
    const ratio = squaredLength === 0 ? 0 : Math.min(1, Math.max(0, ((point.x - start.x) * horizontal + (point.y - start.y) * vertical) / squaredLength));
    return Math.hypot(point.x - (start.x + horizontal * ratio), point.y - (start.y + vertical * ratio));
  }
  private graphRouteLength(points: GraphPoint[]): number {
    return points.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  }
  private graphRouteScore(points: GraphPoint[], occupiedRoutes: GraphPoint[][], source: GraphPhaseNode, target: GraphPhaseNode): number {
    const lowerEdge = Math.max(source.y, target.y);
    const lowerDepth = Math.max(0, ...points.map((point) => point.y - lowerEdge));
    const lowerRoutePenalty = lowerDepth === 0 ? 0 : 500 + lowerDepth * 4;
    return this.graphRouteLength(points) + this.graphRouteLanePenalty(points, occupiedRoutes) + lowerRoutePenalty;
  }
  private graphRouteLanePenalty(points: GraphPoint[], occupiedRoutes: GraphPoint[][]): number {
    let penalty = 0;
    for (let index = 1; index < points.length - 2; index += 1) {
      for (const occupied of occupiedRoutes) {
        for (let occupiedIndex = 1; occupiedIndex < occupied.length - 2; occupiedIndex += 1) {
          const lane = this.graphSharedLane(points[index], points[index + 1], occupied[occupiedIndex], occupied[occupiedIndex + 1]);
          if (!lane) continue;
          penalty += lane.separation < GRAPH_ROUTE_SEPARATION
            ? GRAPH_ROUTE_OVERLAP_PENALTY + lane.overlap
            : lane.separation * GRAPH_ROUTE_SPACING_COST;
        }
      }
    }
    return penalty;
  }
  private graphSharedLane(start: GraphPoint, end: GraphPoint, occupiedStart: GraphPoint, occupiedEnd: GraphPoint): { separation: number; overlap: number } | undefined {
    const horizontal = start.y === end.y && occupiedStart.y === occupiedEnd.y;
    const vertical = start.x === end.x && occupiedStart.x === occupiedEnd.x;
    if (!horizontal && !vertical) return undefined;
    const firstLength = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
    const occupiedLength = horizontal ? Math.abs(occupiedEnd.x - occupiedStart.x) : Math.abs(occupiedEnd.y - occupiedStart.y);
    // Cotovelos curtos não representam corredores compartilhados e não devem
    // decidir a faixa usada pelo trecho principal da ligação.
    if (firstLength < GRAPH_ROUTE_SEPARATION * 5 || occupiedLength < GRAPH_ROUTE_SEPARATION * 5) return undefined;
    const overlap = horizontal
      ? this.graphIntervalOverlap(start.x, end.x, occupiedStart.x, occupiedEnd.x)
      : this.graphIntervalOverlap(start.y, end.y, occupiedStart.y, occupiedEnd.y);
    if (overlap === 0) return undefined;
    return { separation: horizontal ? Math.abs(start.y - occupiedStart.y) : Math.abs(start.x - occupiedStart.x), overlap };
  }
  private graphIntervalOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): number {
    return Math.max(0, Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) - Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)));
  }
  private graphPath(points: GraphPoint[]): string {
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  }
  private graphRoutePosition(points: GraphPoint[], progress: number): { point: GraphPoint; normal: GraphPoint } {
    const routeLength = this.graphRouteLength(points);
    let remaining = routeLength * (progress / 100);
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      if (remaining <= segmentLength || index === points.length - 2) {
        const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
        return {
          point: { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio },
          normal: segmentLength === 0 ? { x: 0, y: 0 } : { x: -(end.y - start.y) / segmentLength, y: (end.x - start.x) / segmentLength },
        };
      }
      remaining -= segmentLength;
    }
    return { point: points.at(-1)!, normal: { x: 0, y: 0 } };
  }
  private graphDemandLaneOffsets(count: number): number[] {
    const offsets = [0];
    for (let distance = 1; offsets.length < count; distance += 1) {
      offsets.push(-distance * GRAPH_DEMAND_LANE_SEPARATION);
      if (offsets.length < count) offsets.push(distance * GRAPH_DEMAND_LANE_SEPARATION);
    }
    return offsets;
  }
  private phaseVisits(events: TimelineEvent[]): PhaseVisit[] {
    const visits: PhaseVisit[] = [];
    for (const event of events) {
      const previous = visits.at(-1);
      if (previous?.status === event.status) {
        if (event.timelineEndedAt > previous.endedAt) previous.endedAt = event.timelineEndedAt;
        previous.usesLogicalTime ||= event.usesLogicalTime;
      } else {
        visits.push({ status: event.status, startedAt: event.timelineStartedAt, endedAt: event.timelineEndedAt, usesLogicalTime: event.usesLogicalTime });
      }
    }
    return visits;
  }
  graphLabelLines(status: string): string[] {
    const maximumLineLength = 18;
    const words = status.split(/\s+/).flatMap((word) =>
      word.length > maximumLineLength
        ? word.match(new RegExp(`.{1,${maximumLineLength}}`, "g")) ?? [word]
        : [word],
    );
    const lines: string[] = [];
    for (const word of words) {
      const current = lines.at(-1);
      if (current && `${current} ${word}`.length <= maximumLineLength) lines[lines.length - 1] = `${current} ${word}`;
      else lines.push(word);
    }
    return lines;
  }
}
