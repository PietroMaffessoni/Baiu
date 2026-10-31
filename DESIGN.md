---
name: Baiu
description: Finanças pessoais com um baiacu que enche e brilha conforme o fôlego do dinheiro.
colors:
  night: "#0F1A3D"
  night-deep: "#0A1230"
  plate: "#16234D"
  plate-hi: "#1E2D5E"
  line: "rgba(168, 184, 238, 0.14)"
  line-strong: "rgba(168, 184, 238, 0.30)"
  paper: "#F4F0E6"
  ink2: "#A9B3D6"
  ink3: "#8590BA"
  lantern: "#FFB648"
  lantern-core: "#FFE3A1"
  lantern-wash: "rgba(255, 182, 72, 0.12)"
  vermilion: "#F2573C"
  vermilion-wash: "rgba(242, 87, 60, 0.14)"
  jade: "#5ED6A7"
  lacquer: "#151A2E"
typography:
  hero:
    fontFamily: "ZenMaru-Black"
    fontSize: "34px"
    fontWeight: 900
    lineHeight: "42px"
    letterSpacing: "-0.4px"
  title1:
    fontFamily: "ZenMaru-Bold"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.3px"
  title2:
    fontFamily: "ZenMaru-Bold"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "27px"
  title3:
    fontFamily: "ZenMaru-Bold"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "23px"
  body:
    fontFamily: "system-ui (SF Pro no iOS, Roboto no Android)"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  body-strong:
    fontFamily: "system-ui (SF Pro no iOS, Roboto no Android)"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  callout:
    fontFamily: "system-ui (SF Pro no iOS, Roboto no Android)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  caption:
    fontFamily: "system-ui (SF Pro no iOS, Roboto no Android)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  micro:
    fontFamily: "system-ui (SF Pro no iOS, Roboto no Android)"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.2px"
  big-money:
    fontFamily: "ZenMaru-Black"
    fontSize: "36px a 46px"
    fontWeight: 900
    lineHeight: "1.22"
    letterSpacing: "-0.8px"
rounded:
  plate: "18px"
  pill: "999px"
spacing:
  gutter: "20px"
  section: "36px"
  plate-pad: "14px"
  stack: "12px"
components:
  button-primary:
    backgroundColor: "{colors.lantern}"
    textColor: "{colors.night}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.lantern}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "44px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.vermilion}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  icon-button:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    size: "44px"
  plate:
    backgroundColor: "{colors.plate}"
    rounded: "{rounded.plate}"
    padding: "{spacing.plate-pad}"
  plate-pressed:
    backgroundColor: "{colors.plate-hi}"
  input-search:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "48px"
  chip-choice:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "40px"
  chip-choice-selected:
    backgroundColor: "{colors.lantern}"
    textColor: "{colors.night}"
  tab-bar:
    backgroundColor: "{colors.night-deep}"
    textColor: "{colors.ink3}"
  tab-bar-selected:
    textColor: "{colors.lantern}"
---

# Design System: Baiu

## Overview

**Creative North Star: "O Baiacu na Noite"**

O Baiu acontece numa noite índigo. Um chão aizome cobre cada tela, de ponta a ponta. A luz da interface é âmbar, no tom das ações que a pessoa pode tocar; a luz do mascote é a do próprio Baiu, um baiacu que boia no topo do Início e derrama um brilho suave, na cor que a pessoa escolheu, sobre o chão. Tudo o mais é papel washi sobre índigo, em três tintas (papel, ink2, ink3). A saúde financeira não vira gráfico de rosca nem cartão com gradiente: vira tamanho, brilho e respiração do mascote.

A densidade é de app de banco usado em sessões curtas e muitas vezes à noite: um número grande por tela, listas de linhas compactas em placas, títulos em Zen Maru Gothic pesada e todo o resto na fonte do sistema. A profundidade vem de tom e de fio fino, nunca de sombra. Vermelhão e jade não decoram; aparecem só como estado (selo carimbado, alerta, dinheiro que entrou).

O sistema é adaptativo: a barra de abas é nativa (UITabBar no iPhone, barra Material no Android), os ícones são SF Symbols no iOS e Material Symbols no Android, e o app é escuro por decisão (userInterfaceStyle "dark"); não existe modo claro. Nada aqui foi verificado em aparelho ou simulador; os valores vêm do código.

**Key Characteristics:**
- Chão índigo único (night) em todas as telas, sem modo claro.
- Uma luz de interface: âmbar para ação e "hoje". O mascote brilha na cor dele.
- Vermelhão e jade apenas como estado.
- Placas separadas por fio fino (hairline), sem sombras.
- Zen Maru Gothic Black/Bold para números grandes e títulos; fonte do sistema para leitura.
- Todo valor em reais com algarismos tabulares.
- O mascote é instrumento: tamanho e brilho leem o fôlego, sempre com texto ao lado.

## Colors

Uma noite índigo em camadas tonais, papel quente para o texto e uma única luz âmbar; dois tons de estado guardados para quando significam algo.

### Primary
- **Âmbar de Lanterna** (lantern): a luz do mundo. Botão primário, links de seção ("Ver tudo"), barra de "hoje" no DayBars, marca cheia, aba selecionada, cursor de texto (selectionColor), glifo do próximo hábito. Também é a cor padrão do Baiu (Âmbar) e, com ela, do halo e do GroundLight.
- **Miolo da Chama** (lantern-core): o centro quente do gradiente do pingo do i no Wordmark e das luzes do mascote. Não é cor de interface.
- **Véu de Lanterna** (lantern-wash): fundo translúcido de glifos de ação (círculo de "Adicionar conta", glifo de tipo de conta) e ripple das abas no Android.

### Secondary
- **Vermelhão Hanko** (vermilion): tinta dos selos conquistados, marca riscada (alerta), botão destrutivo, badge das abas e `notification` do tema. Nunca em ação comum.
- **Véu de Vermelhão** (vermilion-wash): preenchimento interno do selo carimbado.

### Tertiary
- **Jade de Entrada** (jade): dinheiro que entrou. Valores positivos com `colorize`, ponto sob os dias com entrada no DayBars, glifo de transação de entrada, legenda "Entrou".

### Neutral
- **Noite Aizome** (night): chão de todas as telas, cabeçalhos empilhados, fundo do ícone adaptativo e da splash. Também é a cor do texto sobre âmbar.
- **Noite Funda** (night-deep): um degrau abaixo do chão; barra de abas e folha do Fôlego (formSheet).
- **Placa** (plate): superfície elevada por tom; placas, linhas de busca, IconButton, glifos de transação.
- **Placa Acesa** (plate-hi): estado pressionado de placas e IconButton, indicador da aba no Android, trilhos de progresso.
- **Fio** (line): borda hairline das placas e divisores (Rule).
- **Fio Forte** (line-strong): borda de chips e do botão secundário, marca vazia, base do DayBars, dias sem gasto.
- **Papel Washi** (paper): texto principal e números.
- **Tinta 2** (ink2): texto secundário, R$ e centavos do BigMoney, rótulos de campo.
- **Tinta 3** (ink3): metadados, legendas, ícones inativos, placeholders, selo ainda não conquistado.
- **Laca** (lacquer): reservada; não usar em interface.

### Named Rules
**The One Light Rule.** A única luz de interface é âmbar. Se algo precisa chamar o toque ou marcar "agora", é lantern; nenhuma outra cor cumpre esse papel. A cor escolhida para o Baiu vale só para o mascote, o halo e o GroundLight, nunca para botões ou estados.

**The State-Only Rule.** Vermelhão e jade só aparecem quando carregam estado: selo conquistado, alerta, ação destrutiva (vermelhão); dinheiro que entrou (jade). Nunca como decoração ou cor de seção.

**The Three Tints Rule.** Texto sobre índigo usa só papel, ink2 e ink3, nessa ordem de importância.

## Typography

**Display Font:** Zen Maru Gothic (ZenMaru-Black 900, ZenMaru-Bold 700), carregada via expo-font
**Body Font:** fonte do sistema (SF Pro no iOS, Roboto no Android)

**Character:** Zen Maru Gothic tem terminais arredondados que ecoam o corpo do baiacu e o traço do Wordmark; pesada, ela carrega números e títulos. A fonte do sistema faz a leitura miúda e mantém o app com cara de nativo em cada plataforma.

### Hierarchy
- **BigMoney** (Black 900, 36 a 46px conforme a tela, entrelinha 1.22x, -0.8px): o saldo da tela. "R$" e centavos rebaixados para 42% do tamanho em Bold ink2; o inteiro em Black papel. Um por tela.
- **Hero** (Black 900, 34px, 42px): números de destaque secundários.
- **Title1** (Bold 700, 30px, 38px, -0.3px): título de tela de aba e de passo de fluxo.
- **Title2** (Bold 700, 20px, 27px): título de seção e linha de humor do Baiu.
- **Title3** (Bold 700, 17px, 23px): saudação, títulos curtos; também o título dos cabeçalhos empilhados.
- **Body / BodyStrong** (sistema 400/600, 16px, 22px): texto corrido, rótulo de botão, valores de placa.
- **Callout / CalloutStrong** (sistema 400/600, 15px, 20px): descrição de transação, links de seção, subtítulos.
- **Caption / CaptionStrong** (sistema 400/600, 13px, 18px): metadados, rótulos de campo.
- **Micro** (sistema 400, 12px, 16px, +0.2px): legendas de gráfico, nota de demonstração.

Escala de fonte do sistema: títulos travam o crescimento (title1 até 1.25x, title2 até 1.3x, hero até 1.2x); o resto cresce até 1.6x.

### Named Rules
**The Tabular Money Rule.** Todo valor em reais passa por Money ou BigMoney e usa algarismos de largura fixa; valores nunca são texto solto.

**The Heavy Numbers Rule.** Zen Maru é para números grandes e títulos. Texto de leitura, listas e rótulos ficam na fonte do sistema.

## Layout

Coluna única de celular, retrato, com margem lateral fixa (gutter, 20px) em toda tela. Seções empilham com 36px acima de cada título de seção e 12px entre o título e o conteúdo. Placas usam 14px de respiro interno; linhas de transação têm altura mínima de 60px e divisores recuados 50px para alinhar com o texto, não com o glifo. O rodapé de rolagem reserva o inset inferior mais 110px para a barra de abas.

O Início abre com um palco: o fio desce do topo (inset superior + 26px), o Baiu ocupa cerca de metade da largura (até 200px) no terço superior, e saudação e ações flutuam sobre o palco. Abaixo, centralizados: humor, chip de fôlego, saldo. As contas correm numa faixa horizontal de placas de 150px com gap de 10px que sangra até a borda.

Ações destrutivas ficam isoladas por espaço vazio (72px acima do "Remover conta"), sozinhas no fim da tela.

## Elevation & Depth

Não há sombras no sistema: nenhum componente declara shadow ou elevation, e os cabeçalhos desligam a sombra nativa. A profundidade se faz em degraus de tom (night-deep, night, plate, plate-hi) e com fios hairline. A única "elevação" luminosa é o brilho do Baiu: o halo radial atrás dele e o GroundLight, um gradiente radial no chão, os dois na cor escolhida para o mascote e com intensidade que acompanha o fôlego.

### Named Rules
**The Thread Not Shadow Rule.** Superfícies se separam por tom e por fio fino (hairline em line), nunca por sombra.

**The Light Is Data Rule.** Brilho âmbar no chão só existe ligado ao fôlego; não é decoração de fundo.

## Shapes

Formas cheias e arredondadas, como o baiacu. Placas têm cantos de 18px com curva contínua (borderCurve continuous); tudo que é tocável e linear (botões, busca, chips, chip de fôlego) é pílula; glifos, IconButtons e marcas são círculos. Monogramas de banco usam quadrado com raio de 30% do lado. O Wordmark é traço único de espessura constante com pontas redondas. A forma "folha" (formSheet) do Fôlego usa 28px.

O vocabulário de estado é a marca em célula fixa (Mark): cheia (círculo âmbar com visto), parcial (anel âmbar com fatia), vazia (anel line-strong), riscada (anel e risco vermelhão), sempre no mesmo lugar da linha.

## Components

### Buttons
- **Shape:** pílula (999px), altura mínima de 52px, 22px de respiro lateral; ícone opcional de 18px a 8px do rótulo.
- **Primary:** fundo lantern, texto night em BodyStrong. Uma ação primária por tela.
- **Secondary:** fundo plate com fio line-strong, texto papel.
- **Quiet:** sem fundo, texto lantern, altura 44px; para a alternativa ao lado de uma primária.
- **Danger:** sem fundo, borda vermelhão a 45%, texto vermelhão; sempre isolado.
- **Pressed / Disabled:** opacidade 0.86 com escala 0.985; desabilitado a 0.4. Toque dispara haptic de seleção; ripple branco a 12% no Android.
- **IconButton:** círculo de 44px em plate com fio line, ícone de 19px; pressionado vira plate-hi.

### Chips
- **Chip de escolha:** pílula de 48x40px com fio line-strong; selecionado vira lantern cheio com texto night.
- **Chip de fôlego:** pílula de 36px com fio line-strong sobre plate translúcido, Mark parcial + "Fôlego N de 100" + chevron; abre a explicação.

### Cards / Containers
- **Corner Style:** 18px, curva contínua.
- **Background:** plate; pressionado, plate-hi.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** hairline em line.
- **Internal Padding:** 14px.
- **Placa de adicionar:** mesma forma, sem fundo, borda tracejada âmbar; o convite é vazio, não cheio.

### Inputs / Fields
- **Style:** fundo plate, fio hairline line, texto papel 16px, placeholder ink3, altura mínima 48px; busca é pílula com ícone ink3 à esquerda.
- **Focus:** cursor e seleção em lantern; teclado escuro.
- **Valor monetário:** digitado num teclado numérico próprio (teclas de 58px, sem borda, pressionadas em plate) e exibido como BigMoney de 52px.

### Navigation
- **Abas:** NativeTabs com fundo night-deep, ícones e rótulos ink3, selecionado lantern, indicador plate-hi e badge vermelhão. Ícones contornados que preenchem ao selecionar no iOS.
- **Telas empilhadas:** cabeçalho night sem sombra, título Zen Maru Bold 17px papel, voltar em lantern só com o chevron.
- **Fôlego:** formSheet a 94% sobre night-deep, com alça visível.

### Linha de Transação (TxRow)
Glifo circular de 38px (plate com fio; entrada em jade translúcido com ícone jade), descrição em CalloutStrong, metadados em Caption ink3 unidos por " · ", valor à direita com sinal sempre visível e jade se positivo.

### Selo Hanko (Seal)
Carimbo circular de anel duplo em vermelhão, texto em Zen Maru Black caixa-alta, inclinação de até 6 graus derivada da semente e três falhas de tinta na cor do chão. Não conquistado: tinta ink3, anel tracejado, sem inclinação, 70% de opacidade. A caixa-alta é do carimbo, não do sistema.

### Mês em Barras (DayBars)
Uma barra fina por dia (até 6px, gap 3px), altura pela raiz do gasto; dias com gasto em papel a 62%, sem gasto em fio; hoje em lantern; ponto jade sob dias com entrada; base hairline.

### O Baiu (mascote)
Baiacu em SVG, de frente: corpo redondo, barriga clara, pintas no dorso, nadadeiras peitorais, dorsal pequena e rabo saindo atrás do corpo. Quatro humores (estufado, cheio, meio, murcho) mudam silhueta, rosto e pele: o murcho cede para baixo e fica apagado, com dobras na barriga; o estufado vira bola com espinhos. A escala vai de 0.8 a 1.0 com o fôlego. Boia devagar (3s), bate as nadadeiras mais rápido quanto melhor o humor e pisca. Tocar estufa em mola, mostra os espinhos, intensifica o halo e vibra; soltar volta ao fôlego real. Com Reduzir Movimento ativo, fica parado. O estado sempre acompanha texto (linha de humor e "Fôlego N de 100").

**Cor.** Sempre âmbar, sem escolha de cor nem enfeites de data. A paleta do corpo sai do tom base em HSL; o humor mexe na saturação e na luz, então o murcho fica apagado.

## Do's and Don'ts

### Do:
- **Do** pintar toda tela sobre night e usar night-deep só para a barra de abas e folhas.
- **Do** reservar lantern para o que se toca e para "hoje".
- **Do** separar superfícies por tom (plate, plate-hi) e fio hairline em line.
- **Do** passar todo valor por Money ou BigMoney, com algarismos tabulares e respeito ao modo de ocultar valores.
- **Do** mostrar estado com a marca em célula fixa (cheia, parcial, vazia, riscada) no mesmo lugar da linha.
- **Do** isolar a ação destrutiva no fim da tela, com espaço vazio acima.
- **Do** acompanhar qualquer leitura do Baiu com texto e respeitar Reduzir Movimento.
- **Do** usar SF Symbols no iOS e Material Symbols no Android pelo componente Icon.

### Don't:
- **Don't** usar sombra, elevation ou brilho como profundidade; o único brilho é o do Baiu.
- **Don't** usar vermelhão ou jade como decoração, cor de seção ou de marca.
- **Don't** fazer cartão de saldo com gradiente, carrossel de cartões de crédito ou rosca de categorias.
- **Don't** desenhar a marca real de um banco; BankMark é monograma com iniciais e cor próxima.
- **Don't** criar modo claro ou fundo branco.
- **Don't** colocar Zen Maru em texto de leitura nem a fonte do sistema no número grande.
