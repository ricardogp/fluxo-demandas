# Fluxo Demandas

Aplicação desktop Tauri + Angular para reproduzir visualmente a evolução de demandas de software a partir de uma planilha Excel.

## Planilha de entrada

Na primeira aba do arquivo `.xlsx` ou `.xls`, cada linha representa a permanência de uma demanda em uma situação. São reconhecidos os cabeçalhos `Número da demanda`, `Título da demanda`, `Situação`, `Data de início` e `Data de fim` (também são aceitas variações sem acentos, como `Número`, `Título`, `Status`, `Etapa`, `Início` e `Fim`).

| Número da demanda | Título da demanda | Situação | Data de início | Data de fim |
| --- | --- | --- | --- | --- |
| DEM-142 | Login com SSO | Análise | 02/09/2026 | 05/09/2026 |
| DEM-142 | Login com SSO | Desenvolvimento | 06/09/2026 | 18/09/2026 |

A aplicação ordena as linhas de cada demanda por data e infere a sequência das situações a partir das transições encontradas. A linha do tempo aceita navegação nos dois sentidos; durante a reprodução, cada intervalo consome tempo proporcional à duração registrada na planilha.

Cada situação também exibe métricas calculadas até a data atualmente selecionada: máximo de demandas simultâneas, tempo médio e os percentis 90 e 95 do tempo de permanência. Uma demanda que ainda está na situação contribui com o tempo decorrido até aquele passo. Datas sem horário são tratadas como dias inteiros, incluindo a data final.

O tema claro é o padrão da aplicação. O botão na barra superior alterna para o tema escuro sem alterar os dados importados ou a posição da simulação.

Use o botão `+ Situações visíveis` para expandir o filtro de etapas. Desmarcar uma situação a oculta da visualização e do contador de demandas em andamento; a simulação e os cálculos históricos permanecem baseados em todos os dados importados.

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
