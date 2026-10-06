import { DecimalPipe } from "@angular/common";
import { Component, computed, signal } from "@angular/core";
import * as XLSX from "xlsx";

interface DemandEvent {
  demandNumber: string;
  demandTitle: string;
  status: string;
  startedAt: Date;
  endedAt: Date;
  row: number;
}

interface DemandHistory {
  number: string;
  title: string;
  events: DemandEvent[];
}

interface ActiveDemand {
  number: string;
  title: string;
  event: DemandEvent;
  progress: number;
}

interface StatusMetrics {
  maxConcurrent: number;
  averageMs: number;
  p90Ms: number;
  p95Ms: number;
}

type SpreadsheetRow = Record<string, unknown>;

const SAMPLE_EVENTS: DemandEvent[] = [
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", status: "Descoberta", startedAt: new Date(2026, 7, 3), endedAt: new Date(2026, 7, 7), row: 2 },
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", status: "Desenvolvimento", startedAt: new Date(2026, 7, 8), endedAt: new Date(2026, 7, 22), row: 3 },
  { demandNumber: "DEM-1042", demandTitle: "Portal de fornecedores", status: "Validação", startedAt: new Date(2026, 7, 23), endedAt: new Date(2026, 7, 27), row: 4 },
  { demandNumber: "DEM-1057", demandTitle: "Central de ajuda", status: "Descoberta", startedAt: new Date(2026, 7, 9), endedAt: new Date(2026, 7, 12), row: 5 },
  { demandNumber: "DEM-1057", demandTitle: "Central de ajuda", status: "Desenvolvimento", startedAt: new Date(2026, 7, 13), endedAt: new Date(2026, 8, 2), row: 6 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", status: "Descoberta", startedAt: new Date(2026, 7, 16), endedAt: new Date(2026, 7, 18), row: 7 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", status: "Desenvolvimento", startedAt: new Date(2026, 7, 19), endedAt: new Date(2026, 8, 4), row: 8 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", status: "Validação", startedAt: new Date(2026, 8, 5), endedAt: new Date(2026, 8, 10), row: 9 },
  { demandNumber: "DEM-1071", demandTitle: "Relatório de SLA", status: "Entregue", startedAt: new Date(2026, 8, 11), endedAt: new Date(2026, 8, 11), row: 10 },
];

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
  readonly speed = signal(1);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly sourceName = signal("Exemplo de simulação");
  readonly currentTime = signal(this.timelineStart().getTime());

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
      .map(([number, events]) => ({
        number,
        title: events[0].demandTitle,
        events: [...events].sort((first, second) => first.startedAt.getTime() - second.startedAt.getTime() || first.row - second.row),
      }))
      .sort((first, second) => first.number.localeCompare(second.number, "pt-BR", { numeric: true }));
  });

  readonly statusOrder = computed(() => this.inferStatusOrder(this.histories()));
  readonly statusMetrics = computed(() => this.calculateStatusMetrics(this.events(), this.currentTime()));
  readonly activeByStatus = computed(() => {
    const current = this.currentTime();
    const lanes = new Map<string, ActiveDemand[]>();

    for (const history of this.histories()) {
      const event = history.events.find((item) => this.contains(item, current));
      if (!event) continue;

      const active = lanes.get(event.status) ?? [];
      active.push({ number: history.number, title: history.title, event, progress: this.eventProgress(event, current) });
      lanes.set(event.status, active);
    }
    return lanes;
  });

  readonly activeCount = computed(() => [...this.activeByStatus().values()].reduce((total, items) => total + items.length, 0));
  readonly currentDate = computed(() => new Date(this.currentTime()));
  readonly sliderValue = computed(() => {
    const range = this.timelineEnd().getTime() - this.timelineStart().getTime();
    return range === 0 ? 0 : ((this.currentTime() - this.timelineStart().getTime()) / range) * 1000;
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
    this.currentTime.set(start + ((end - start) * value) / 1000);
  }

  togglePlayback(): void { this.playing() ? this.pause() : this.play(); }
  toggleTheme(): void { this.theme.update((theme) => theme === "light" ? "dark" : "light"); }
  setSpeed(speed: number): void { this.speed.set(speed); }
  timelineLabel(): string { return this.currentDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  rangeLabel(date: Date): string { return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  durationLabel(durationMs: number): string {
    const days = durationMs / 86_400_000;
    return `${days.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`;
  }

  laneColor(status: string): string {
    const colors = ["#6f77dc", "#d79b42", "#3aa888", "#d76370", "#4e91c7", "#8a6ec5"];
    return colors[this.statusOrder().indexOf(status) % colors.length] ?? colors[0];
  }

  trackByNumber(_index: number, item: ActiveDemand): string { return item.number; }

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
      const status = String(row[statusHeader] ?? "").trim();
      const startedAt = this.parseDate(row[startHeader]);
      const endedAt = this.parseDate(row[endHeader]);
      if (!demandNumber && !demandTitle && !status && !startedAt && !endedAt) return;
      if (!demandNumber || !demandTitle || !status || !startedAt || !endedAt) throw new Error(`A linha ${index + 2} está incompleta. Informe número, título, situação, início e fim.`);
      if (endedAt < startedAt) throw new Error(`A data final da linha ${index + 2} é anterior à data inicial.`);
      events.push({ demandNumber, demandTitle, status, startedAt, endedAt, row: index + 2 });
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
  timelineEnd(): Date { return this.dateOnly(this.events().reduce((latest, item) => item.endedAt > latest ? item.endedAt : latest, this.events()[0]?.endedAt ?? new Date())); }

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

  private contains(event: DemandEvent, time: number): boolean { return time >= event.startedAt.getTime() && time <= event.endedAt.getTime() + 86_399_999; }
  private eventDurationMs(event: DemandEvent, asOf = Number.POSITIVE_INFINITY): number {
    return Math.min(event.endedAt.getTime(), asOf) - event.startedAt.getTime() + 86_400_000;
  }
  private eventProgress(event: DemandEvent, time: number): number {
    const length = Math.max(event.endedAt.getTime() - event.startedAt.getTime(), 1);
    return Math.min(100, Math.max(0, ((time - event.startedAt.getTime()) / length) * 100));
  }
}
