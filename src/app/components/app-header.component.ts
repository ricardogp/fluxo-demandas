import { Component, input, output } from "@angular/core";
import { EmbeddedWorkbook } from "../services/embedded-workbooks";

@Component({
  selector: "fd-app-header",
  template: `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">↗</span><span>fluxo<span>_</span>demandas</span></div>
      <div class="topbar-actions">
        @if (embeddedWorkbooks().length) { <label class="embedded-workbook-picker">DEMANDAS<select [value]="selectedEmbeddedWorkbook()" (change)="embeddedSpreadsheetChanged($event)" [disabled]="loading()">@for (workbook of embeddedWorkbooks(); track workbook.fileName) { <option [value]="workbook.fileName">{{ workbook.displayName }}</option> }</select></label> }
        <button class="theme-toggle" type="button" (click)="toggleTheme.emit()" [attr.aria-label]="theme() === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'">
          <span aria-hidden="true">{{ theme() === 'light' ? '☾' : '☀' }}</span>{{ theme() === 'light' ? 'Tema escuro' : 'Tema claro' }}
        </button>
          <label class="import-button is-disabled" aria-disabled="true">
          <input type="file" accept=".xlsx,.xls" (change)="spreadsheetSelected.emit($event)" disabled />
          <span>Importar planilha</span>
        </label>
      </div>
    </header>
  `,
})
export class AppHeaderComponent {
  readonly theme = input.required<"light" | "dark">();
  readonly loading = input.required<boolean>();
  readonly embeddedWorkbooks = input.required<EmbeddedWorkbook[]>();
  readonly selectedEmbeddedWorkbook = input.required<string>();
  readonly toggleTheme = output<void>();
  readonly spreadsheetSelected = output<Event>();
  readonly embeddedSpreadsheetSelected = output<string>();

  embeddedSpreadsheetChanged(event: Event): void { this.embeddedSpreadsheetSelected.emit((event.target as HTMLSelectElement).value); }
}
