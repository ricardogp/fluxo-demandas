import { Component, input, output } from "@angular/core";
import { TimelineChartView } from "../domain/demand.models";

@Component({
  selector: "fd-timeline-controls",
  template: `
    <section class="time-control" aria-labelledby="timeline-title">
      <div class="timeline-heading"><div><h2 id="timeline-title">Linha do tempo das demandas</h2><p class="timeline-instruction">Arraste o marcador para explorar o fluxo em outra data ou sequência do mesmo dia; use Reproduzir para avançar automaticamente.</p></div></div>
      <div class="timeline-chart-block">
        <div class="timeline-chart-heading">
          <span class="timeline-chart-heading-label">Demandas não concluídas no desenvolvimento<span class="timeline-chart-help"><button type="button" aria-label="Exibir situações consideradas no gráfico" aria-describedby="timeline-chart-scope-hint">?</button><span class="timeline-chart-scope-hint" id="timeline-chart-scope-hint" role="tooltip">Situações consideradas: {{ timelineChartScopeLabel() }}</span></span></span>
          <strong>Pico: {{ peakLabel() }}</strong>
        </div>
        <svg class="timeline-chart" [attr.viewBox]="'0 0 ' + timelineChart().width + ' ' + timelineChart().height" preserveAspectRatio="none" role="img" [attr.aria-label]="timelineChartAriaLabel()">
          <title>{{ timelineChartAriaLabel() }}</title>
          <text class="timeline-chart-scale timeline-chart-scale-start-max" x="3" y="11" text-anchor="start">{{ timelineChart().maximum }}</text>
          <text class="timeline-chart-scale timeline-chart-scale-start-zero" x="3" [attr.y]="timelineChart().baseline - 1" text-anchor="start">0</text>
          <text class="timeline-chart-scale timeline-chart-scale-end-max" [attr.x]="timelineChart().width - 3" y="11" text-anchor="end">{{ timelineChart().maximum }}</text>
          <text class="timeline-chart-scale timeline-chart-scale-end-zero" [attr.x]="timelineChart().width - 3" [attr.y]="timelineChart().baseline - 1" text-anchor="end">0</text>
          <line class="timeline-chart-baseline" x1="0" [attr.x2]="timelineChart().width" [attr.y1]="timelineChart().baseline" [attr.y2]="timelineChart().baseline" />
          <polygon class="timeline-chart-area" [attr.points]="timelineChart().areaPoints" />
          <polyline class="timeline-chart-line" [attr.points]="timelineChart().linePoints" />
          <line class="timeline-chart-current" [attr.x1]="sliderValue()" [attr.x2]="sliderValue()" y1="0" [attr.y2]="timelineChart().baseline" />
          @if (timelineChart().peak.count > 0) { <line class="timeline-chart-peak" [attr.x1]="timelineChart().peak.x" [attr.x2]="timelineChart().peak.x" [attr.y1]="timelineChart().peak.y" [attr.y2]="timelineChart().baseline" /> }
        </svg>
      </div>
      <div class="timeline-slider">
        <input class="timeline" type="range" min="0" [max]="timelineSliderMaximum()" [value]="sliderInputValue()" (input)="scrub.emit($event)" aria-label="Navegar na linha do tempo" [attr.aria-valuetext]="timelineLabel()" />
        <div class="selected-date" [class.at-start]="sliderValue() <= 1" [class.at-end]="sliderValue() >= 999" [style.left.%]="sliderValue() / 10"><span>DATA EXIBIDA</span><strong>{{ timelineLabel() }}</strong></div>
      </div>
      <div class="date-row"><span>{{ rangeLabel()(timelineStart()) }}</span><span>{{ rangeLabel()(timelineEnd()) }}</span></div>
      <div class="playback-row">
        <button class="play-button" type="button" (click)="togglePlayback.emit()" [attr.aria-label]="playing() ? 'Pausar simulação' : 'Reproduzir simulação'"><span aria-hidden="true">{{ playing() ? 'Ⅱ' : '▶' }}</span>{{ playing() ? 'Pausar' : 'Reproduzir' }}</button>
        <div class="speed-control" aria-label="Velocidade da simulação"><span>VELOCIDADE</span>@for (option of speedOptions(); track option) { <button type="button" [class.active]="speed() === option" (click)="setSpeed.emit(option)">{{ option }}x</button> }</div>
      </div>
    </section>
  `,
})
export class TimelineControlsComponent {
  readonly speedOptions = input.required<number[]>();
  readonly timelineSliderMaximum = input.required<number>();
  readonly sliderInputValue = input.required<number>();
  readonly sliderValue = input.required<number>();
  readonly timelineLabel = input.required<string>();
  readonly timelineChart = input.required<TimelineChartView>();
  readonly timelineStart = input.required<Date>();
  readonly timelineEnd = input.required<Date>();
  readonly rangeLabel = input.required<(date: Date) => string>();
  readonly playing = input.required<boolean>();
  readonly speed = input.required<number>();
  readonly scrub = output<Event>();
  readonly togglePlayback = output<void>();
  readonly setSpeed = output<number>();

  peakLabel(): string {
    const peak = this.timelineChart().peak;
    if (peak.count === 0) return "sem demandas nas situações acompanhadas";
    return `${peak.count} ${peak.count === 1 ? "demanda" : "demandas"} · ${this.rangeLabel()(new Date(peak.time))}`;
  }

  timelineChartAriaLabel(): string {
    return `Quantidade de demandas nas situações ${this.timelineChartScopeLabel()} ao longo da linha do tempo. Pico de ${this.peakLabel()}.`;
  }

  timelineChartScopeLabel(): string { return this.timelineChart().statuses.join(", "); }
}
