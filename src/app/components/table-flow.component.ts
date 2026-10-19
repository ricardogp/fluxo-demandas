import { Component, input, output } from "@angular/core";

import { ActiveDemand, DemandRepresentation, StatusMetrics } from "../domain/demand.models";

@Component({
  selector: "fd-table-flow",
  template: `
    <label class="demand-representation">Representação das demandas
      <select [value]="demandRepresentation()" (change)="setDemandRepresentation.emit($any($event.target).value)"><option value="detailedCard">Cartão detalhado</option><option value="number">Número da demanda</option></select>
    </label>
    <section class="flow" aria-label="Fluxo de demandas por situação">
      @for (status of visibleStatusOrder(); track status) {
        <article class="lane" [style.--lane-color]="laneColor(status)">
          <header class="lane-header"><div class="lane-title"><span class="lane-dot"></span><h2>{{ status }}</h2><span class="lane-count">{{ visibleActiveByStatus().get(status)?.length ?? 0 }}</span></div>
            @if (statusMetrics().get(status); as metrics) { <dl class="lane-statistics" aria-label="Estatísticas de {{ status }}"><div><dt>MÁX.</dt><dd>{{ metrics.maxConcurrent }}</dd></div><div><dt>P90</dt><dd>{{ durationLabel()(metrics.p90Ms) }}</dd></div><div><dt>P95</dt><dd>{{ durationLabel()(metrics.p95Ms) }}</dd></div></dl> } @else { <p class="statistics-empty">Sem dados até esta data.</p> }
          </header>
          <div class="lane-content" [class.number-representation]="demandRepresentation() === 'number'">
            @for (item of visibleActiveByStatus().get(status) ?? []; track trackByNumber($index, item)) {
              <article class="demand-card" [class.demand-number]="demandRepresentation() === 'number'" tabindex="0" (pointerenter)="showDemandHint($event, item)" (pointerleave)="hideDemandHint()" (focusin)="showDemandHint($event, item)" (focusout)="hideDemandHint()" [attr.aria-describedby]="'demand-hint-' + item.number">
                <h3 [style.color]="demandTypeColor(item.demandType)">{{ item.number }}</h3>
                <p class="card-date-range" [attr.aria-label]="'Período de ' + rangeLabel()(item.event.startedAt) + ' até ' + rangeLabel()(item.event.endedAt)"><span>{{ cardDateLabel()(item.event.startedAt) }}</span><span class="card-date-range-separator" aria-hidden="true">a</span><span>{{ cardDateLabel()(item.event.endedAt) }}</span></p><div class="progress-track" aria-hidden="true"><span [style.width.%]="item.progress"></span></div>
              </article>
            } @empty { <p class="empty-lane">Nenhuma demanda nesta etapa.</p> }
          </div>
        </article>
      }
    </section>
  `,
})
export class TableFlowComponent {
  readonly visibleStatusOrder = input.required<string[]>();
  readonly visibleActiveByStatus = input.required<Map<string, ActiveDemand[]>>();
  readonly statusMetrics = input.required<Map<string, StatusMetrics>>();
  readonly demandRepresentation = input.required<DemandRepresentation>();
  readonly laneColorFn = input.required<(status: string) => string>({ alias: "laneColor" });
  readonly demandTypeColorFn = input.required<(type: string) => string>({ alias: "demandTypeColor" });
  readonly durationLabel = input.required<(duration: number) => string>();
  readonly rangeLabel = input.required<(date: Date) => string>();
  readonly cardDateLabel = input.required<(date: Date) => string>();
  readonly setDemandRepresentation = output<DemandRepresentation>();
  readonly demandHint = output<{ event: Event; item: ActiveDemand }>();
  readonly hideHint = output<void>();
  laneColor(status: string): string { return this.laneColorFn()(status); }
  demandTypeColor(type: string): string { return this.demandTypeColorFn()(type); }
  trackByNumber(_index: number, item: ActiveDemand): string { return item.number; }
  showDemandHint(event: Event, item: ActiveDemand): void { this.demandHint.emit({ event, item }); }
  hideDemandHint(): void { this.hideHint.emit(); }
}
