# Fluxo Demandas

Aplicação desktop Tauri + Angular para reproduzir visualmente a evolução de demandas de software a partir de uma planilha Excel.

## Planilha de entrada

Na primeira aba do arquivo `.xlsx` ou `.xls`, cada linha representa a permanência de uma demanda em uma situação. São reconhecidos os cabeçalhos `Número da demanda`, `Título da demanda`, `Situação`, `Data de início` e `Data de fim` (também são aceitas variações sem acentos, como `Número`, `Título`, `Status`, `Etapa`, `Início` e `Fim`). A coluna opcional `Tipo de demanda`, à direita das demais, identifica o tipo da demanda.

| Número da demanda | Título da demanda | Situação | Data de início | Data de fim | Tipo de demanda |
| --- | --- | --- | --- | --- | --- |
| DEM-142 | Login com SSO | Análise | 02/09/2026 | 05/09/2026 | Evolutiva |
| DEM-142 | Login com SSO | Desenvolvimento | 06/09/2026 | 18/09/2026 | Evolutiva |

A aplicação ordena as linhas de cada demanda por data e infere a sequência das situações a partir das transições encontradas. A linha do tempo aceita navegação nos dois sentidos; durante a reprodução, cada intervalo consome tempo proporcional à duração registrada na planilha. Quando duas ou mais etapas da mesma demanda começam na mesma data, a ordem das linhas cria subpassos lógicos naquele dia. Assim, a tabela e o grafo mostram cada transição separadamente, sem alterar as datas, os períodos ou as métricas originais da planilha. O marcador identifica esses pontos como “sequência do dia”.

Cada situação também exibe métricas calculadas até a data atualmente selecionada: máximo de demandas simultâneas, tempo médio e os percentis 90 e 95 do tempo de permanência. Uma demanda que ainda está na situação contribui com o tempo decorrido até aquele passo. Datas sem horário são tratadas como dias inteiros, incluindo a data final.

O tema claro é o padrão da aplicação. O botão na barra superior alterna para o tema escuro sem alterar os dados importados ou a posição da simulação.

Use o botão `+ Situações visíveis` para expandir o filtro de etapas. Desmarcar uma situação a oculta da visualização e do contador de demandas em andamento; a simulação e os cálculos históricos permanecem baseados em todos os dados importados.

Ao passar o mouse ou navegar por teclado até um card de demanda, um painel contextual apresenta o título, o tipo da demanda e o tempo acumulado em cada situação até a data selecionada.

Na visualização em tabela, o seletor **Representação das demandas** alterna entre o **Cartão detalhado** e **Número da demanda**. O primeiro é o padrão e mantém o progresso e o intervalo em três linhas: início em `dd/mmm`, a preposição “a” centralizada e fim em `dd/mmm`. A segunda opção usa um retângulo de largura total na coluna, com o número em destaque; ela preserva o painel contextual ao passar o mouse ou navegar por teclado. Cada coluna de situação comporta dois cartões detalhados por linha ou um retângulo numérico por linha.

O controle do tempo fica imediatamente acima das situações e reúne a navegação da linha do tempo, a reprodução e a velocidade em uma área compacta. A data exibida acompanha o marcador durante a navegação. A visualização do fluxo pode ser alternada entre as abas **Formato de tabela** e **Formato de grafo**. No grafo em níveis, as fases são nós ordenados da esquerda para a direita; quando não há espaço suficiente para mantê-las sem sobreposição, elas continuam em um novo nível. Os nós de 0 a 3 demandas usam escala de cinza. A partir daí, os limiares são absolutos: 4 ou 5 demandas ficam em âmbar, 6 ou 7 ficam em vermelho para sinalizar carga crítica e 8 ou mais ficam em roxo. As setas são inferidas das transições da planilha, usam cinza neutro e os pequenos nós das demandas avançam pela rota durante o tempo de permanência na fase de origem, inclusive nos subpassos de uma sequência do mesmo dia. Rotas com demanda em trânsito recebem realce âmbar. Durante a reprodução, o realce e os marcadores são animados discretamente, exceto quando o sistema indica preferência por reduzir movimentos. Quando uma ligação encontraria outra fase, o roteamento preserva também a área ocupada pelos rótulos e prioriza um corredor livre acima dos nós; corredores laterais ou inferiores ficam reservados aos casos em que a opção superior não é viável. Rotas que usariam o mesmo corredor são distribuídas em níveis vizinhos, e novos níveis superiores são abertos enquanto houver sobreposição. No grafo em níveis, o raio dos nós é 25% maior e as portas de uma mesma face são ordenadas pela posição espacial de aproximação, evitando cruzamentos e pequenos ganchos junto à borda. Rótulos, setas, nós das demandas e espaçamentos preservam a escala compacta; todas as ligações usam a mesma espessura, independentemente da frequência da transição. Rótulos longos passam para novas linhas, sem abreviação.

O contador no centro de cada nó substitui a distribuição das demandas estacionadas ao seu redor. No grafo em níveis, o seletor **Representação das demandas** permite escolher entre o círculo colorido padrão e um pequeno retângulo ajustado ao número da demanda; ambos percorrem a mesma rota e preservam o painel contextual por mouse ou teclado. Quando várias demandas percorrem a mesma ligação, elas ocupam faixas laterais: uma permanece sobre a linha se o total for ímpar, e as demais se distribuem simetricamente de cada lado. Todas as ligações que chegam ou saem pelo mesmo lado de uma fase recebem portas e segmentos finais próprios, para permanecerem distinguíveis.

Abaixo do grafo, uma legenda associa a cor de cada marcador ao respectivo tipo de demanda visível.

Os filtros de visualização de situações, demandas e tipos de demanda ficam recolhidos em botões e exibem checkboxes ao serem clicados. As opções recebem as cores correspondentes à situação ou ao tipo de demanda e são distribuídas em tantas colunas quanto necessário, com no máximo três linhas por filtro.

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
