import { Component, input, output } from "@angular/core";

import { DemandHistory, VisibilityFilter } from "../domain/demand.models";

@Component({
  selector: "fd-visibility-filters",
  template: `
    <section class="visibility-controls" aria-label="Filtros de visualização">
      <div class="visibility-filter">
        <button class="visibility-filter-trigger" type="button" (click)="toggleVisibilityFilter.emit('status')" [attr.aria-expanded]="visibilityFilterExpanded('status')" aria-controls="visible-status-options">
          <span>Situações visíveis</span><small>{{ visibleStatusSummary() }}</small><span class="filter-symbol" aria-hidden="true">{{ visibilityFilterExpanded('status') ? '−' : '+' }}</span>
        </button>
        @if (visibilityFilterExpanded('status')) {
          <div class="visibility-options" id="visible-status-options">
            @for (status of statusOrder(); track status) {
              <label class="visibility-option">
                <input type="checkbox" [checked]="statusVisible(status)" (change)="toggleStatusVisibility.emit(status)" />
                <span class="visibility-option-dot" [style.background]="laneColor(status)" aria-hidden="true"></span>
                <span class="visibility-option-title" [style.color]="laneColor(status)" [title]="status">{{ status }}</span>
              </label>
            }
          </div>
        }
      </div>
      <div class="visibility-filter">
        <button class="visibility-filter-trigger" type="button" (click)="toggleVisibilityFilter.emit('demand')" [attr.aria-expanded]="visibilityFilterExpanded('demand')" aria-controls="visible-demand-options">
          <span>Demandas visíveis</span><small>{{ visibleDemandSummary() }}</small><span class="filter-symbol" aria-hidden="true">{{ visibilityFilterExpanded('demand') ? '−' : '+' }}</span>
        </button>
        @if (visibilityFilterExpanded('demand')) {
          <div class="visibility-options" id="visible-demand-options">
            @for (history of histories(); track history.number) {
              <label class="visibility-option">
                <input type="checkbox" [checked]="demandVisible(history.number)" (change)="toggleDemandVisibility.emit(history.number)" />
                <span class="visibility-option-dot" [style.background]="demandTypeColor(history.demandType)" aria-hidden="true"></span>
                <span class="visibility-option-title" [style.color]="demandTypeColor(history.demandType)" [title]="history.number + ' — ' + history.title">{{ history.number }} — {{ history.title }}</span>
              </label>
            }
          </div>
        }
      </div>
      <div class="visibility-filter">
        <button class="visibility-filter-trigger" type="button" (click)="toggleVisibilityFilter.emit('demandType')" [attr.aria-expanded]="visibilityFilterExpanded('demandType')" aria-controls="visible-demand-type-options">
          <span>Tipos de demanda visíveis</span><small>{{ visibleDemandTypeSummary() }}</small><span class="filter-symbol" aria-hidden="true">{{ visibilityFilterExpanded('demandType') ? '−' : '+' }}</span>
        </button>
        @if (visibilityFilterExpanded('demandType')) {
          <div class="visibility-options" id="visible-demand-type-options">
            @for (demandType of demandTypeOrder(); track demandType) {
              <label class="visibility-option">
                <input type="checkbox" [checked]="demandTypeVisible(demandType)" (change)="toggleDemandTypeVisibility.emit(demandType)" />
                <span class="visibility-option-dot" [style.background]="demandTypeColor(demandType)" aria-hidden="true"></span>
                <span class="visibility-option-title" [style.color]="demandTypeColor(demandType)" [title]="demandType">{{ demandType }}</span>
              </label>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class VisibilityFiltersComponent {
  readonly statusOrder = input.required<string[]>();
  readonly histories = input.required<DemandHistory[]>();
  readonly demandTypeOrder = input.required<string[]>();
  readonly visibleStatusSummary = input.required<string>();
  readonly visibleDemandSummary = input.required<string>();
  readonly visibleDemandTypeSummary = input.required<string>();
  readonly visibilityFilterExpandedFn = input.required<(filter: VisibilityFilter) => boolean>({ alias: "visibilityFilterExpanded" });
  readonly statusVisibleFn = input.required<(status: string) => boolean>({ alias: "statusVisible" });
  readonly demandVisibleFn = input.required<(number: string) => boolean>({ alias: "demandVisible" });
  readonly demandTypeVisibleFn = input.required<(type: string) => boolean>({ alias: "demandTypeVisible" });
  readonly laneColorFn = input.required<(status: string) => string>({ alias: "laneColor" });
  readonly demandTypeColorFn = input.required<(type: string) => string>({ alias: "demandTypeColor" });
  readonly toggleVisibilityFilter = output<VisibilityFilter>();
  readonly toggleStatusVisibility = output<string>();
  readonly toggleDemandVisibility = output<string>();
  readonly toggleDemandTypeVisibility = output<string>();

  visibilityFilterExpanded(filter: VisibilityFilter): boolean { return this.visibilityFilterExpandedFn()(filter); }
  statusVisible(status: string): boolean { return this.statusVisibleFn()(status); }
  demandVisible(number: string): boolean { return this.demandVisibleFn()(number); }
  demandTypeVisible(demandType: string): boolean { return this.demandTypeVisibleFn()(demandType); }
  laneColor(status: string): string { return this.laneColorFn()(status); }
  demandTypeColor(demandType: string): string { return this.demandTypeColorFn()(demandType); }
}
