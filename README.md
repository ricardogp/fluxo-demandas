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

Ao passar o mouse ou navegar por teclado até um card de demanda, um painel contextual apresenta o título e o tempo acumulado em cada situação até a data selecionada.

## Desenvolvimento

```bash
npm install
npm run start
```

Para gerar o frontend:

```bash
npm run build
```

## Aplicativo desktop

Os comandos abaixo geram o aplicativo instalável para o sistema operacional em que forem executados:

```bash
npm run desktop:dev
npm run desktop:build
```

Os arquivos gerados ficam em `src-tauri/target/release/bundle/`. No Windows, serão produzidos instaladores `.msi` e `.exe` (NSIS); no Linux, `.AppImage`, `.deb` e `.rpm`.

Para compilar localmente, instale o Rust estável e os pré-requisitos do Tauri. Em Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf xdg-utils
```

No Windows, instale o Rust com o toolchain MSVC e as Ferramentas de Build do Visual Studio com o workload de desenvolvimento em C++.

O workflow manual **Desktop bundles** em GitHub Actions gera os instaladores Windows e Linux sem exigir que a máquina local tenha Rust ou as bibliotecas Linux instaladas. Depois de executá-lo em **Actions**, os arquivos ficam disponíveis como artefatos do workflow.
