import * as XLSX from "xlsx";

import { DemandEvent } from "../domain/demand.models";

type SpreadsheetRow = Record<string, unknown>;

/** Parses the supported spreadsheet contract independently from the UI. */
export class SpreadsheetImporter {
  async readFile(file: File): Promise<DemandEvent[]> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("A planilha não possui uma aba para leitura.");
    const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(workbook.Sheets[firstSheetName], { defval: null, raw: true });
    return this.parseRows(rows);
  }

  parseRows(rows: SpreadsheetRow[]): DemandEvent[] {
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
}
