# Etapa 02 — padrão visual compartilhado

Concluída em 12/10/2026. Entrega de componentes reutilizáveis para as etapas seguintes; ainda não aplica a reformulação às telas de Conhecimento, Relatórios, Gestão ou às quatro telas secundárias.

## Entregas

| Arquivo | API e uso |
|---|---|
| `platform/src/components/layout/page-heading.tsx` | `PageHeading`, com `variant="compact"` opt-in; padrão anterior preservado |
| `platform/src/components/layout/empty-state.tsx` | Extração do EmptyState existente; evita importar os componentes de curso/provider para exibir uma mensagem |
| `platform/src/components/layout/metric-card.tsx` | `MetricCard`, com estados available/loading/partial/unavailable, contexto e ação opcional |
| `platform/src/components/layout/filter-bar.tsx` | `FilterBar`, campos/ações/filtros avançados e `AppliedFilters` com remoção individual/limpeza |
| `platform/src/components/layout/data-state.tsx` | `DataState`: carregamento, erro com retry, vazio com orientação/ação e falha parcial preservando conteúdo válido |
| `platform/src/components/ui/alert.tsx` | Alert, AlertTitle e AlertDescription, composição adaptada ao CSS/tokens existentes |
| `platform/src/components/ui/skeleton.tsx` | Skeleton decorativo sem números fictícios ou animação obrigatória |
| `platform/src/components/ui/field.tsx` | FieldSet, FieldLegend, FieldGroup, Field, FieldLabel e FieldDescription para filtros com rótulos visíveis |
| `platform/src/styles/page-layout.css` | Estilos isolados, temas por tokens, escala responsiva e controles de 44px |
| `platform/src/components/shared.tsx` | Reexporta PageHeading e EmptyState; imports atuais continuam funcionando |
| `platform/src/app/globals.css` | Somente o novo import, após responsive.css; o import preexistente de Trilhas foi preservado |

Consultado o contexto via shadcn CLI: Next 16.3.5, Tailwind v4, estilo new-york, base Radix, Button/Badge existentes. As composições de Alert/Skeleton/Field seguem o catálogo consultado, adaptadas à folha temática atual. Não foi instalado pacote novo, preset ou biblioteca de componentes completa. Dialog/Sheet será escolhido quando a ficha operacional for implementada; não há consumidor nesta etapa que justifique adicioná-lo agora.

## Padrão entregue

- Cabeçalho compacto: esquerda, título 28px desktop e 24px até 600px, peso 700; descrição 16px desktop e 14px mobile. Ações podem quebrar para a linha seguinte sem sobrepor texto.
- Cards: 20px de padding desktop/16px mobile, rótulo 14px, valor 32px, contexto 14px e cobertura 13px. Grid adapta colunas à largura e não impõe altura que corte texto.
- Filtros: grupos semânticos, rótulos 14px, campos 16px e altura mínima 44px. “Mais filtros” usa details/summary nativo com foco visível.
- Filtros aplicados: nome/valor completos, remoção nomeada e limpeza; chip pode quebrar e encolher sem deslocar o botão para fora do celular.
- Estados: nenhuma fonte indisponível é mostrada como zero; zero válido continua visível. Erro e dados parciais têm texto explícito e ações de retry; vazio usa EmptyState existente.
- Fontes/ícones/temas: Inter, Lucide, Button, Badge, tokens do sistema. Estilos são opt-in; PageHeading sem variante mantém a escala legada.
- Contraste: textos de descrição e resumo de filtros receberam mistura de tokens limitada aos novos componentes. Botão primário dentro dos novos blocos usa o token sólido existente de ação, para assegurar contraste do texto branco sem alterar todos os botões da plataforma.
- Não há overlay, busca, request de dados ou lógica de negócio nova nesta etapa. Componentes recebem estado/dados/callbacks dos consumidores futuros.

## Exemplos mínimos

Preferir imports diretos dos componentes de layout para evitar dependências de curso/provider. O import antigo de PageHeading por shared.tsx também funciona.

```tsx
import { PageHeading } from "@/components/layout/page-heading";
import { MetricCard } from "@/components/layout/metric-card";
import { Button } from "@/components/ui/button";

<PageHeading variant="compact" title="Relatórios"
  description="Entenda a participação e a evolução da equipe.">
  <Button onClick={exportCsv}>Baixar CSV</Button>
</PageHeading>

<div className="metric-grid">
  <MetricCard label="Com acesso" value={0} context="De 19 colaboradores" />
  <MetricCard label="Tempo ativo estimado" state="loading" />
  <MetricCard label="XP no período" state="partial" value="1.200"
    reason="O intervalo inclui dias anteriores à coleta." />
  <MetricCard label="Nota média" state="unavailable"
    reason="Não foi possível consultar as avaliações." />
</div>
```

Valores acima são exemplos, não números da plataforma. O consumidor formata a unidade/valor em pt-BR e identifica explicitamente estimativas. Não passar valor numérico para loading/unavailable: o tipo discriminado impede esse uso. Dados desconhecidos não equivalem a zero.

```tsx
import { FilterBar, AppliedFilters } from "@/components/layout/filter-bar";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";

<FilterBar label="Filtros do relatório" busy={loading}>
  <Field>
    <FieldLabel htmlFor="report-person">Colaborador</FieldLabel>
    <select id="report-person" aria-describedby="report-person-help"
      value={personId} onChange={event => setPersonId(event.target.value)}>
      <option value="all">Todos os colaboradores</option>
    </select>
    <FieldDescription id="report-person-help">
      Somente pessoas da sua gestão.
    </FieldDescription>
  </Field>
</FilterBar>

<AppliedFilters filters={appliedFilters} onClear={clearFilters} disabled={loading} />
```

Cada AppliedFilter tem id, label, value e onRemove opcional. IDs de campos devem ser únicos por instância; usar useId no consumidor se mais de uma barra puder existir. Busy indica carregamento, mas não bloqueia controles automaticamente: o consumidor decide disabled conforme sua operação. Para validação, aplicar data-invalid no Field, aria-invalid no controle e vincular descrição/erro por aria-describedby.

```tsx
import { DataState } from "@/components/layout/data-state";

<DataState state="error" description={errorMessage}
  onRetry={reload} retrying={loading} />

<DataState state="partial" description="A fonte de avaliações não respondeu."
  onRetry={reload} retrying={loading}>
  <AvailableResults data={availableData} />
</DataState>

<DataState state="empty" title="Nenhum resultado para estes filtros"
  description="Ajuste o período ou selecione outro colaborador." />
```

Empty e loading não aceitam dados analíticos como children. Error não renderiza children; partial preserva somente o conteúdo fornecido como válido pelo consumidor. Os callbacks não consultam fontes nem alteram filtros por conta própria.

## Verificação executada

- `pnpm exec tsc --noEmit`: passou no estado final, após remover a página temporária e regenerar os tipos locais de rota.
- `pnpm exec next typegen --webpack`: passou.
- `git diff --check`: passou.
- Playwright em Chromium: página local temporária com os componentes reais, fonte/CSS reais e dados sintéticos; nenhum dado ou request de produção.
- 12 combinações: claro/escuro × 1440, 1024, 768, 390, 375 e 844px (este último em landscape). Sem sobreposição do cabeçalho, overflow horizontal ou controles cortados; controles examinados ≥44px.
- Contraste mínimo medido entre os textos/ações examinados: **4,515:1**. Verificação de cores computadas em estados normais; não é declaração de conformidade WCAG integral.
- Ampliação de conteúdo via CSS zoom 200%: sem overflow. Isso complementa reflow em viewports pequenas; não substitui um ensaio de zoom nativo de todos os navegadores.
- Teclado: abertura dos filtros avançados por Enter, foco visível, ação de retry e callback de remoção do filtro. Conteúdo válido permaneceu visível após falha parcial.
- Zero legítimo, loading sem número e indisponibilidade distinta de zero verificados; prefers-reduced-motion exercitado. Sem erros de página.
- Capturas desktop e mobile inspecionadas visualmente. O teste identificou e permitiu corrigir contraste secundário de 4,48:1 e o encolhimento de um chip longo de filtro.

Evidências locais:

- [Claro — desktop](<C:/Users/Daniel José/.codex/visualizations/2026/10/12/01a13253-523d-7262-89c8-7748a2f432d7/stage02/light-1440.png>)
- [Escuro — celular](<C:/Users/Daniel José/.codex/visualizations/2026/10/12/01a13253-523d-7262-89c8-7748a2f432d7/stage02/dark-390.png>)
- [Resultados da verificação](<C:/Users/Daniel José/.codex/visualizations/2026/10/12/01a13253-523d-7262-89c8-7748a2f432d7/stage02/verification.json>)

A página de prévia e seu tipo de rota gerado foram removidos. O servidor iniciado para esta inspeção foi encerrado. Não foram criados testes permanentes que apenas espelhem as classes/markup dos componentes. A etapa 03 usará essas APIs em Conhecimento; telas secundárias continuam reservadas à etapa 09.
