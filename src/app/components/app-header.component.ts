import { Component, input, output } from "@angular/core";

@Component({
  selector: "fd-app-header",
  template: `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">↗</span><span>fluxo<span>_</span>demandas</span></div>
      <div class="topbar-actions">
        <button class="theme-toggle" type="button" (click)="toggleTheme.emit()" [attr.aria-label]="theme() === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'">
          <span aria-hidden="true">{{ theme() === 'light' ? '☾' : '☀' }}</span>{{ theme() === 'light' ? 'Tema escuro' : 'Tema claro' }}
        </button>
        <label class="import-button" [class.is-loading]="loading()">
          <input type="file" accept=".xlsx,.xls" (change)="spreadsheetSelected.emit($event)" [disabled]="loading()" />
          <span>{{ loading() ? 'Lendo planilha…' : 'Importar planilha' }}</span>
        </label>
      </div>
    </header>
  `,
})
export class AppHeaderComponent {
  readonly theme = input.required<"light" | "dark">();
  readonly loading = input.required<boolean>();
  readonly toggleTheme = output<void>();
  readonly spreadsheetSelected = output<Event>();
}
