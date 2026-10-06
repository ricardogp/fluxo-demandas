# Fluxo Demandas

Aplicação desktop Tauri + Angular para reproduzir visualmente a evolução de demandas de software a partir de uma planilha Excel.

## Planilha de entrada

Na primeira aba do arquivo `.xlsx` ou `.xls`, cada linha representa a permanência de uma demanda em uma situação. São reconhecidos os cabeçalhos `Demanda`, `Situação`, `Data de início` e `Data de fim` (também são aceitas variações sem acentos, como `Status`, `Etapa`, `Início` e `Fim`).

| Demanda | Situação | Data de início | Data de fim |
| --- | --- | --- | --- |
| Login com SSO | Análise | 02/09/2026 | 05/09/2026 |
| Login com SSO | Desenvolvimento | 06/09/2026 | 18/09/2026 |

A aplicação ordena as linhas de cada demanda por data e infere a sequência das situações a partir das transições encontradas. A linha do tempo aceita navegação nos dois sentidos; durante a reprodução, cada intervalo consome tempo proporcional à duração registrada na planilha.

## Desenvolvimento

```bash
npm install
npm run start
```

Para gerar o frontend:

```bash
npm run build
```

Para executar como aplicação desktop, instale o Rust e os pré-requisitos Linux do Tauri e então use:

```bash
npm run tauri dev
```
