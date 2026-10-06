# Fluxo Demandas

Aplicação desktop Tauri + Angular para reproduzir visualmente a evolução de demandas de software a partir de uma planilha Excel.

## Planilha de entrada

Na primeira aba do arquivo `.xlsx` ou `.xls`, cada linha representa a permanência de uma demanda em uma situação. São reconhecidos os cabeçalhos `Número da demanda`, `Título da demanda`, `Situação`, `Data de início` e `Data de fim` (também são aceitas variações sem acentos, como `Número`, `Título`, `Status`, `Etapa`, `Início` e `Fim`). A coluna opcional `Tipo de demanda`, à direita das demais, identifica o tipo da demanda.

| Número da demanda | Título da demanda | Situação | Data de início | Data de fim | Tipo de demanda |
| --- | --- | --- | --- | --- | --- |
| DEM-142 | Login com SSO | Análise | 02/09/2026 | 05/09/2026 | Evolutiva |
| DEM-142 | Login com SSO | Desenvolvimento | 06/09/2026 | 18/09/2026 | Evolutiva |

A aplicação ordena as linhas de cada demanda por data e infere a sequência das situações a partir das transições encontradas. A linha do tempo aceita navegação nos dois sentidos; durante a reprodução, cada intervalo consome tempo proporcional à duração registrada na planilha.

Cada situação também exibe métricas calculadas até a data atualmente selecionada: máximo de demandas simultâneas, tempo médio e os percentis 90 e 95 do tempo de permanência. Uma demanda que ainda está na situação contribui com o tempo decorrido até aquele passo. Datas sem horário são tratadas como dias inteiros, incluindo a data final.

O tema claro é o padrão da aplicação. O botão na barra superior alterna para o tema escuro sem alterar os dados importados ou a posição da simulação.

Use o botão `+ Situações visíveis` para expandir o filtro de etapas. Desmarcar uma situação a oculta da visualização e do contador de demandas em andamento; a simulação e os cálculos históricos permanecem baseados em todos os dados importados.

Ao passar o mouse ou navegar por teclado até um card de demanda, um painel contextual apresenta o título e o tempo acumulado em cada situação até a data selecionada.

Cada coluna de situação comporta duas demandas por linha. Os cards são compactos e apresentam o intervalo em três linhas: início em `dd/mmm`, a preposição “a” centralizada e fim em `dd/mmm`.

O controle do tempo fica imediatamente acima das situações e reúne a navegação da linha do tempo, a reprodução e a velocidade em uma área compacta. A data exibida acompanha o marcador durante a navegação.

Os filtros de visualização permitem selecionar múltiplas situações, demandas e tipos de demanda. Cada tipo recebe uma cor própria no número exibido no card. Para selecionar itens não contíguos na lista, use `Ctrl` no Windows/Linux ou `⌘` no macOS.

## Desenvolvimento

```bash
npm install
npm run start
```

Para gerar o frontend:

```bash
npm run build
```

Além da saída do Angular em `dist/`, esse comando gera `static/index.html`: um único arquivo HTML com o CSS e JavaScript incorporados. Ele pode ser copiado e aberto localmente no navegador, sem depender dos demais arquivos da pasta de build.

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
