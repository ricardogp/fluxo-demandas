import { DecimalPipe } from "@angular/common";
import { Component, input, output } from "@angular/core";

import { ActiveDemand, GraphDemandRepresentation, GraphRoutingAlgorithm, GraphView } from "../domain/demand.models";

@Component({
  selector: "fd-flow-graph",
  imports: [DecimalPipe],
  template: `
    <label class="demand-representation graph-demand-representation">Representação das demandas
      <select [value]="graphDemandRepresentation()" (change)="setGraphDemandRepresentation.emit($any($event.target).value)"><option value="circle">Círculo colorido</option><option value="number">Número da demanda</option></select>
    </label>
    <label class="demand-representation graph-routing-algorithm">Algoritmo do grafo
      <select [value]="graphRoutingAlgorithm()" (change)="setGraphRoutingAlgorithm.emit($any($event.target).value)"><option value="standard">Algoritmo padrão</option><option value="optimized">Algoritmo otimizado</option></select>
    </label>
    <svg class="graph-canvas" [class.is-playing]="playing()" [attr.viewBox]="'0 0 1000 ' + graph().height" role="img" aria-label="Fluxo das demandas por fase, distribuído em níveis">
      <defs><marker id="graph-arrow" markerWidth="4.5" markerHeight="4.5" refX="4" refY="2.25" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 4.5 2.25 L 0 4.5 z" fill="context-stroke"></path></marker></defs>
      @for (transition of graph().transitions; track transition.source + transition.target) { <path class="graph-transition" [class.active]="transition.activeDemandCount > 0" [attr.d]="transition.path" [attr.stroke]="transition.color" [attr.stroke-width]="transition.strokeWidth" marker-end="url(#graph-arrow)"><title>{{ transition.source }} para {{ transition.target }} · {{ transition.count }} transição(ões){{ transition.activeDemandCount ? ' · ' + transition.activeDemandCount + ' demanda(s) em trânsito' : '' }}</title></path> }
      @for (phase of graph().phases; track phase.status) {
        <g class="graph-phase" tabindex="0" (pointerenter)="showPhaseHint($event, phase.status)" (pointerleave)="hidePhaseHint()" (focusin)="showPhaseHint($event, phase.status)" (focusout)="hidePhaseHint()" [attr.aria-describedby]="phaseHintId(phase.status)" [attr.aria-label]="'Fase ' + phase.status + ': ' + phase.activeCount + ' demanda(s)'">
          <circle class="graph-phase-node" [attr.cx]="phase.x" [attr.cy]="phase.y" [attr.fill]="phase.color" [attr.stroke]="phase.color" r="13.75"></circle><text class="graph-phase-count" [attr.x]="phase.x" [attr.y]="phase.y" [attr.fill]="phase.countColor">{{ phase.activeCount }}</text><title>{{ phase.status }} · {{ phase.activeCount }} demanda(s) em andamento{{ phase.loadState === 'overloaded' ? ' · carga muito alta' : phase.loadState === 'critical' ? ' · carga crítica' : phase.loadState === 'warning' ? ' · carga elevada' : '' }}</title><text class="graph-phase-label" [attr.x]="phase.x" [attr.y]="phase.y + 25">@for (line of phase.labelLines; track $index) { <tspan [attr.x]="phase.x" [attr.dy]="$index === 0 ? 0 : 7">{{ line }}</tspan> }</text>
        </g>
      }
      @for (demand of graph().demands; track demand.number) {
        @if (graphDemandRepresentation() === 'circle') { <circle class="graph-demand" [attr.cx]="demand.x" [attr.cy]="demand.y" [attr.fill]="demand.color" [attr.stroke]="demand.routeColor" r="3.5" tabindex="0" (pointerenter)="showDemandHint($event, demand.item)" (pointerleave)="hideDemandHint()" (focusin)="showDemandHint($event, demand.item)" (focusout)="hideDemandHint()" [attr.aria-describedby]="'demand-hint-' + demand.number" [attr.aria-label]="'Demanda ' + demand.number + ': ' + demand.title"><title>{{ demand.number }} · {{ demand.title }} · {{ demand.source }}{{ demand.target ? ' → ' + demand.target : '' }} · {{ demand.progress | number:'1.0-0' }}%</title></circle> } @else { <g class="graph-demand-label" tabindex="0" (pointerenter)="showDemandHint($event, demand.item)" (pointerleave)="hideDemandHint()" (focusin)="showDemandHint($event, demand.item)" (focusout)="hideDemandHint()" [attr.aria-describedby]="'demand-hint-' + demand.number" [attr.aria-label]="'Demanda ' + demand.number + ': ' + demand.title"><rect [attr.x]="demand.x - graphDemandLabelWidth(demand.number) / 2" [attr.y]="demand.y - 4.5" [attr.width]="graphDemandLabelWidth(demand.number)" height="9" [attr.stroke]="demand.routeColor"></rect><text [attr.x]="demand.x" [attr.y]="demand.y">{{ demand.number }}</text><title>{{ demand.number }} · {{ demand.title }} · {{ demand.source }}{{ demand.target ? ' → ' + demand.target : '' }} · {{ demand.progress | number:'1.0-0' }}%</title></g> }
      }
    </svg>
    <aside class="graph-legend" aria-label="Legenda das cores dos tipos de demanda"><span class="graph-legend-title">Cores das demandas</span>@for (demandType of demandTypeOrder(); track demandType) { @if (demandTypeVisible(demandType)) { <span class="graph-legend-item"><i class="graph-legend-dot" [style.background]="demandTypeColor(demandType)" aria-hidden="true"></i>{{ demandType }}</span> } }</aside>
  `,
})
export class FlowGraphComponent {
  readonly graph = input.required<GraphView>();
  readonly playing = input.required<boolean>();
  readonly graphDemandRepresentation = input.required<GraphDemandRepresentation>();
  readonly graphRoutingAlgorithm = input.required<GraphRoutingAlgorithm>();
  readonly demandTypeOrder = input.required<string[]>();
  readonly demandTypeVisibleFn = input.required<(type: string) => boolean>({ alias: "demandTypeVisible" });
  readonly demandTypeColorFn = input.required<(type: string) => string>({ alias: "demandTypeColor" });
  readonly phaseHintIdFn = input.required<(status: string) => string>({ alias: "phaseHintId" });
  readonly setGraphDemandRepresentation = output<GraphDemandRepresentation>();
  readonly setGraphRoutingAlgorithm = output<GraphRoutingAlgorithm>();
  readonly demandHint = output<{ event: Event; item: ActiveDemand }>();
  readonly hideDemandHintEvent = output<void>({ alias: "hideDemandHint" });
  readonly phaseHint = output<{ event: Event; status: string }>();
  readonly hidePhaseHintEvent = output<void>({ alias: "hidePhaseHint" });
  graphDemandLabelWidth(number: string): number { return Math.max(10, Math.min(36, 3 + number.length * 3.75)); }
  demandTypeVisible(type: string): boolean { return this.demandTypeVisibleFn()(type); }
  demandTypeColor(type: string): string { return this.demandTypeColorFn()(type); }
  phaseHintId(status: string): string { return this.phaseHintIdFn()(status); }
  showDemandHint(event: Event, item: ActiveDemand): void { this.demandHint.emit({ event, item }); }
  hideDemandHint(): void { this.hideDemandHintEvent.emit(); }
  showPhaseHint(event: Event, status: string): void { this.phaseHint.emit({ event, status }); }
  hidePhaseHint(): void { this.hidePhaseHintEvent.emit(); }
}
