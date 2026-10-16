import { DecimalPipe } from "@angular/common";
import { Component, computed, signal } from "@angular/core";
import * as XLSX from "xlsx";

interface DemandEvent {
  demandNumber: string;
  demandTitle: string;
  demandType: string;
  status: string;
  startedAt: Date;
  endedAt: Date;
  row: number;
}

// Mantém o período original para métricas e cria uma escala independente para
// percorrer, em ordem, etapas que a planilha registrou na mesma data.
interface TimelineEvent extends DemandEvent {
  timelineStartedAt: Date;
  timelineEndedAt: Date;
  hasSameDaySequence: boolean;
  usesLogicalTime: boolean;
}

interface DemandHistory {
  number: string;
  title: string;
  demandType: string;
  events: TimelineEvent[];
}

interface ActiveDemand {
  number: string;
  title: string;
  demandType: string;
  event: TimelineEvent;
  events: TimelineEvent[];
  progress: number;
}

interface StatusDuration {
  status: string;
  durationMs: number;
}

interface ActiveHint {
  item: ActiveDemand;
  x: number;
  y: number;
  below: boolean;
}

interface StatusMetrics {
  maxConcurrent: number;
  averageMs: number;
  p90Ms: number;
  p95Ms: number;
}

interface PhaseVisit {
  status: string;
  startedAt: Date;
  endedAt: Date;
  usesLogicalTime: boolean;
}

interface GraphPhaseNode {
  status: string;
  labelLines: string[];
  color: string;
  activeCount: number;
  x: number;
  y: number;
}

interface GraphPoint {
  x: number;
  y: number;
}

interface GraphTransition {
  source: string;
  target: string;
  color: string;
  count: number;
  strokeWidth: number;
  path: string;
  points: GraphPoint[];
}

type GraphPortSide = "top" | "right" | "bottom" | "left";

interface GraphPhasePort {
  transition: GraphTransition;
  pointIndex: number;
  phase: GraphPhaseNode;
  kind: "incoming" | "outgoing";
  side: GraphPortSide;
}

interface GraphDemandNode {
  number: string;
  title: string;
  demandType: string;
  color: string;
  source: string;
  target?: string;
  progress: number;
  terminal: boolean;
  x: number;
  y: number;
}

interface GraphView {
  height: number;
  phases: GraphPhaseNode[];
  transitions: GraphTransition[];
  demands: GraphDemandNode[];
}

type SpreadsheetRow = Record<string, unknown>;
type VisibilityFilter = "status" | "demand" | "demandType";
type VisualizationFormat = "table" | "graph";

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
const GRAPH_MIN_HEIGHT = 150;
const GRAPH_PHASE_RADIUS = 11;
const GRAPH_FLOW_PADDING = 38;
const GRAPH_PHASE_MIN_WIDTH = 80;
const GRAPH_LEVEL_GAP = 75;
const GRAPH_TOP_PADDING = 42;
const GRAPH_BOTTOM_PADDING = 50;
const GRAPH_TRANSITION_MIN_STROKE_WIDTH = 0.75;
const GRAPH_TRANSITION_MAX_STROKE_WIDTH = 1.75;
const GRAPH_ROUTE_CLEARANCE = 19;
const GRAPH_ROUTE_SEPARATION = 6;
const GRAPH_ROUTE_OVERLAP_PENALTY = 10_000;
const GRAPH_ROUTE_SPACING_COST = 0.35;
const GRAPH_PHASE_PORT_SEPARATION = 5;
const DAY_IN_MS = 86_400_000;
const TIMELINE_SLIDER_MAXIMUM = 10_000;

@Component({
  selector: "app-root",
  imports: [DecimalPipe],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
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
  readonly speed = signal(1);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly sourceName = signal("Exemplo de simulação");
  readonly currentTime = signal(this.timelineStart().getTime());
  readonly activeVisualization = signal<VisualizationFormat>("table");
  readonly timelineSliderMaximum = TIMELINE_SLIDER_MAXIMUM;

  private animationFrame?: number;
  private lastFrame?: number;

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
    const maximumActiveCount = Math.max(1, ...activeCounts.values());
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
      return { status, labelLines: this.graphLabelLines(status), color: this.graphPhaseLoadColor(activeCount, maximumActiveCount), activeCount, x, y: GRAPH_TOP_PADDING + level * GRAPH_LEVEL_GAP };
    });
    const phaseByStatus = new Map(graphPhases.map((phase) => [phase.status, phase]));
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

    const occupiedRoutes: GraphPoint[][] = [];
    const transitions = [...transitionCounts.entries()].map(([key, count]) => {
      const [sourceStatus, targetStatus] = key.split("\u0000");
      const source = phaseByStatus.get(sourceStatus)!;
      const target = phaseByStatus.get(targetStatus)!;
      const points = this.graphTransitionPoints(source, target, graphPhases, occupiedRoutes);
      occupiedRoutes.push(points);
      return {
        source: sourceStatus,
        target: targetStatus,
        color: this.laneColor(sourceStatus),
        count,
        strokeWidth: this.graphTransitionWidth(count),
        path: this.graphPath(points),
        points,
      };
    });
    this.separateGraphPorts(transitions, graphPhases);
    const transitionByRoute = new Map(transitions.map((transition) => [`${transition.source}\u0000${transition.target}`, transition]));
    const demands: GraphDemandNode[] = [];
    const terminalDemands: Array<Omit<GraphDemandNode, "x" | "y"> & { phase: GraphPhaseNode }> = [];
    const current = this.currentTime();

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
      const color = this.demandTypeColor(history.demandType);
      const transition = target ? transitionByRoute.get(`${source.status}\u0000${target.status}`) : undefined;
      const progress = this.periodProgress(source.startedAt, source.endedAt, current);

      if (target && targetPhase && transition) {
        const position = this.graphRoutePosition(transition.points, progress);
        demands.push({
          number: history.number,
          title: history.title,
          demandType: history.demandType,
          color,
          source: source.status,
          target: target.status,
          progress,
          terminal: false,
          x: position.x,
          y: position.y,
        });
      } else {
        terminalDemands.push({ number: history.number, title: history.title, demandType: history.demandType, color, source: source.status, progress, terminal: true, phase: sourcePhase });
      }
    }

    terminalDemands.forEach((demand, index) => {
      const countAtPhase = terminalDemands.filter((item) => item.source === demand.source).length;
      const indexAtPhase = terminalDemands.filter((item, itemIndex) => item.source === demand.source && itemIndex < index).length;
      const angle = countAtPhase === 1 ? 0 : (indexAtPhase * Math.PI * 2) / countAtPhase;
      const distance = countAtPhase === 1 ? 0 : 20;
      demands.push({ ...demand, x: demand.phase.x + Math.cos(angle) * distance, y: demand.phase.y + Math.sin(angle) * distance });
    });

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
  readonly hasSameDaySequenceAtCurrent = computed(() => {
    const current = this.currentTime();
    return this.histories().some((history) => history.events.some((event) => event.hasSameDaySequence && this.containsTimeline(event, current)));
  });

  async importSpreadsheet(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.loading.set(true);
    this.error.set("");
    this.pause();

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("A planilha não possui uma aba para leitura.");
      const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[firstSheetName], { defval: null, raw: true });
      const parsed = this.parseRows(rows);
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
    return this.hasSameDaySequenceAtCurrent() ? `${date} · sequência do dia` : date;
  }
  rangeLabel(date: Date): string { return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  cardDateLabel(date: Date): string { return `${date.getDate().toString().padStart(2, "0")}/${MONTH_ABBREVIATIONS[date.getMonth()]}`; }
  durationLabel(durationMs: number): string {
    const days = durationMs / 86_400_000;
    return `${days.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`;
  }

  laneColor(status: string): string {
    const colors = ["#6f77dc", "#d79b42", "#3aa888", "#d76370", "#4e91c7", "#8a6ec5"];
    return colors[this.statusOrder().indexOf(status) % colors.length] ?? colors[0];
  }
  demandTypeColor(demandType: string): string {
    const colors = ["#4f7fd8", "#bd7a18", "#178668", "#ba4d5c", "#6d54b1", "#0d7f95"];
    return colors[this.demandTypeOrder().indexOf(demandType) % colors.length] ?? colors[0];
  }
  graphPhaseLoadColor(activeCount: number, maximumActiveCount: number): string {
    const intensity = activeCount === 0 ? 0 : Math.sqrt(activeCount / Math.max(1, maximumActiveCount));
    const lightness = 88 - intensity * 37;
    return `hsl(215 10% ${lightness.toFixed(1)}%)`;
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
  }
  hideDemandHint(): void { this.activeHint.set(undefined); }

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

  private parseRows(rows: SpreadsheetRow[]): DemandEvent[] {
    if (!rows.length) throw new Error("A primeira aba está vazia.");
    const headers = Object.keys(rows[0] ?? {});
    const demandNumberHeader = this.findHeader(headers, ["numero da demanda", "número da demanda", "numero", "número", "id da demanda"]);
    const demandTitleHeader = this.findHeader(headers, ["titulo da demanda", "título da demanda", "titulo", "título", "nome da demanda"]);
    const demandTypeHeader = this.findHeader(headers, ["tipo de demanda", "tipo"]);
    const statusHeader = this.findHeader(headers, ["situacao", "situação", "status", "etapa"]);
    const startHeader = this.findHeader(headers, ["data inicio", "data de inicio", "início", "inicio", "inicio da etapa"]);
    const endHeader = this.findHeader(headers, ["data fim", "data de fim", "fim", "termino", "término", "fim da etapa"]);
    if (!demandNumberHeader || !demandTitleHeader || !statusHeader || !startHeader || !endHeader) {
      throw new Error("Use as colunas Número da demanda, Título da demanda, Situação, Data de início e Data de fim. Os nomes podem ter pequenas variações.");
    }

    const events: DemandEvent[] = [];
    rows.forEach((row, index) => {
      const demandNumber = String(row[demandNumberHeader] ?? "").trim();
      const demandTitle = String(row[demandTitleHeader] ?? "").trim();
      const demandType = demandTypeHeader ? String(row[demandTypeHeader] ?? "").trim() || "Sem tipo" : "Sem tipo";
      const status = String(row[statusHeader] ?? "").trim();
      const startedAt = this.parseDate(row[startHeader]);
      const endedAt = this.parseDate(row[endHeader]);
      if (!demandNumber && !demandTitle && !status && !startedAt && !endedAt) return;
      if (!demandNumber || !demandTitle || !status || !startedAt || !endedAt) throw new Error(`A linha ${index + 2} está incompleta. Informe número, título, situação, início e fim.`);
      if (endedAt < startedAt) throw new Error(`A data final da linha ${index + 2} é anterior à data inicial.`);
      events.push({ demandNumber, demandTitle, demandType, status, startedAt, endedAt, row: index + 2 });
    });
    return events;
  }

  private findHeader(headers: string[], candidates: string[]): string | undefined { return headers.find((header) => candidates.includes(this.normalize(header))); }
  private normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " "); }

  private parseDate(value: unknown): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return this.dateOnly(value);
    if (typeof value === "number") {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : undefined;
    }
    if (typeof value !== "string") return undefined;
    const brazilian = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brazilian) return new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : this.dateOnly(parsed);
  }

  private dateOnly(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  timelineStart(): Date { return this.dateOnly(this.events().reduce((earliest, item) => item.startedAt < earliest ? item.startedAt : earliest, this.events()[0]?.startedAt ?? new Date())); }
  timelineEnd(): Date { return this.endOfDay(this.events().reduce((latest, item) => item.endedAt > latest ? item.endedAt : latest, this.events()[0]?.endedAt ?? new Date())); }

  private endOfDay(date: Date): Date { return new Date(this.dateOnly(date).getTime() + DAY_IN_MS - 1); }

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
  // A escala logarítmica preserva a diferença entre fluxos sem permitir que
  // uma transição muito frequente domine o desenho.
  private graphTransitionWidth(count: number): number {
    return Math.min(GRAPH_TRANSITION_MAX_STROKE_WIDTH, GRAPH_TRANSITION_MIN_STROKE_WIDTH + Math.log2(Math.max(1, count)) * 0.2);
  }
  // Rotas diretas são preferidas. Quando uma fase ocupa esse segmento, os corredores
  // ao redor das fases são avaliados; faixas vizinhas separam rotas paralelas e a
  // rota externa é a garantia para casos densos.
  private graphTransitionPoints(source: GraphPhaseNode, target: GraphPhaseNode, phases: GraphPhaseNode[], occupiedRoutes: GraphPoint[][]): GraphPoint[] {
    const sourceCenter = { x: source.x, y: source.y };
    const targetCenter = { x: target.x, y: target.y };
    const clearance = GRAPH_PHASE_RADIUS + GRAPH_ROUTE_CLEARANCE;
    const phaseXs = phases.map((phase) => phase.x);
    const phaseYs = phases.map((phase) => phase.y);
    const yChannels = this.graphRouteChannels(phaseYs, clearance);
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
          const sourceY = source.y + clearance * sourceDirection;
          const targetY = target.y + clearance * targetDirection;
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

    const routes = candidates
      .map((candidate) => this.graphRouteEndpoints(candidate, source, target))
      .filter((points) => this.graphRouteClearsPhases(points, phases, new Set([source.status, target.status])))
      .sort((first, second) => this.graphRouteScore(first, occupiedRoutes) - this.graphRouteScore(second, occupiedRoutes));

    return routes[0] ?? this.graphRouteEndpoints([sourceCenter, targetCenter], source, target);
  }
  private graphRouteChannels(coordinates: number[], clearance: number): number[] {
    const sorted = [...new Set(coordinates)].sort((first, second) => first - second);
    const channels = [sorted[0] - clearance, sorted.at(-1)! + clearance];
    for (const coordinate of sorted) channels.push(coordinate - clearance, coordinate + clearance);
    for (let index = 0; index < sorted.length - 1; index += 1) channels.push((sorted[index] + sorted[index + 1]) / 2);
    return [...new Set(channels.flatMap((channel) => [channel, channel - GRAPH_ROUTE_SEPARATION, channel + GRAPH_ROUTE_SEPARATION]))];
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
  private separateGraphPorts(transitions: GraphTransition[], phases: GraphPhaseNode[]): void {
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
      const incoming = portsAtSide.filter((port) => port.kind === "incoming");
      const outgoing = portsAtSide.filter((port) => port.kind === "outgoing");
      if (!incoming.length || !outgoing.length) continue;
      incoming.forEach((port, index) => this.positionGraphPort(port, -(index + .5) * GRAPH_PHASE_PORT_SEPARATION));
      outgoing.forEach((port, index) => this.positionGraphPort(port, (index + .5) * GRAPH_PHASE_PORT_SEPARATION));
    }

    transitions.forEach((transition) => transition.path = this.graphPath(transition.points));
  }
  private graphPortSide(point: GraphPoint, phase: GraphPhaseNode): GraphPortSide {
    const horizontalDistance = point.x - phase.x;
    const verticalDistance = point.y - phase.y;
    if (Math.abs(horizontalDistance) > Math.abs(verticalDistance)) return horizontalDistance < 0 ? "left" : "right";
    return verticalDistance < 0 ? "top" : "bottom";
  }
  private positionGraphPort(port: GraphPhasePort, offset: number): void {
    const point = port.transition.points[port.pointIndex];
    if (port.side === "top" || port.side === "bottom") {
      point.x = port.phase.x + offset;
      point.y = port.phase.y + (port.side === "top" ? -GRAPH_PHASE_RADIUS : GRAPH_PHASE_RADIUS);
      return;
    }
    point.x = port.phase.x + (port.side === "left" ? -GRAPH_PHASE_RADIUS : GRAPH_PHASE_RADIUS);
    point.y = port.phase.y + offset;
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
  private graphRouteClearsPhases(points: GraphPoint[], phases: GraphPhaseNode[], excludedStatuses: Set<string>): boolean {
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const phase of phases) {
        if (excludedStatuses.has(phase.status)) continue;
        if (this.graphDistanceToSegment({ x: phase.x, y: phase.y }, points[index], points[index + 1]) < GRAPH_PHASE_RADIUS + GRAPH_ROUTE_CLEARANCE) return false;
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
  private graphRouteScore(points: GraphPoint[], occupiedRoutes: GraphPoint[][]): number {
    return this.graphRouteLength(points) + this.graphRouteLanePenalty(points, occupiedRoutes);
  }
  private graphRouteLanePenalty(points: GraphPoint[], occupiedRoutes: GraphPoint[][]): number {
    let penalty = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      for (const occupied of occupiedRoutes) {
        for (let occupiedIndex = 0; occupiedIndex < occupied.length - 1; occupiedIndex += 1) {
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
    // Com os nós menores, os segmentos de entrada e saída ficam mais longos.
    // Eles não representam corredores compartilhados e não devem decidir a faixa.
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
  private graphRoutePosition(points: GraphPoint[], progress: number): GraphPoint {
    const routeLength = this.graphRouteLength(points);
    let remaining = routeLength * (progress / 100);
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
      if (remaining <= segmentLength || index === points.length - 2) {
        const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
      }
      remaining -= segmentLength;
    }
    return points.at(-1)!;
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
  private graphLabelLines(status: string): string[] {
    const maximumLineLength = 18;
    const words = status.split(/\s+/).flatMap((word) => word.length > maximumLineLength ? [word.slice(0, maximumLineLength - 1) + "…"] : [word]);
    const lines: string[] = [];
    for (const word of words) {
      const current = lines.at(-1);
      if (current && `${current} ${word}`.length <= maximumLineLength) lines[lines.length - 1] = `${current} ${word}`;
      else lines.push(word);
    }
    if (lines.length <= 2) return lines;
    return [lines[0], `${lines.slice(1).join(" ").slice(0, maximumLineLength - 1)}…`];
  }
}
