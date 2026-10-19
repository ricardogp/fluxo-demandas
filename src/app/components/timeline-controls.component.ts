import { Component, input, output } from "@angular/core";

@Component({
  selector: "fd-timeline-controls",
  template: `
    <section class="time-control" aria-labelledby="timeline-title">
      <div class="timeline-heading"><div><h2 id="timeline-title">Linha do tempo das demandas</h2><p class="timeline-instruction">Arraste o marcador para explorar o fluxo em outra data ou sequência do mesmo dia; use Reproduzir para avançar automaticamente.</p></div></div>
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
  readonly timelineStart = input.required<Date>();
  readonly timelineEnd = input.required<Date>();
  readonly rangeLabel = input.required<(date: Date) => string>();
  readonly playing = input.required<boolean>();
  readonly speed = input.required<number>();
  readonly scrub = output<Event>();
  readonly togglePlayback = output<void>();
  readonly setSpeed = output<number>();
}
