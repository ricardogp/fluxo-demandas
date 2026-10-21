export interface EmbeddedWorkbook {
  fileName: string;
  displayName: string;
  base64: string;
}

declare global {
  interface Window {
    __FLUXO_DEMANDAS_WORKBOOKS__?: EmbeddedWorkbook[];
  }
}

export const EMBEDDED_WORKBOOKS: EmbeddedWorkbook[] = typeof window === "undefined"
  ? []
  : window.__FLUXO_DEMANDAS_WORKBOOKS__ ?? [];
