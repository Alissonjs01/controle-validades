# Controle de Validades

PWA mobile-first para responder uma pergunta simples: **o que tenho, quanto tenho e o que está perto de vencer?**

O projeto já possui fundação PWA, domínio/parser determinístico e a interface principal de movimentações. Ainda não implementa OCR, câmera, autenticação complexa, notificações reais ou integração com IA.

## Stack

- Next.js com App Router
- React + TypeScript strict
- Supabase JS SDK preparado, sem depender de credenciais reais
- Iconoir como biblioteca principal de ícones
- CSS moderno com tokens próprios de design
- Vitest + Testing Library para testes unitários/de componentes
- Playwright para E2E mobile/desktop
- GitHub Actions para CI

## Arquitetura

```txt
src/
  app/             Rotas, layout, manifest PWA
  components/      Componentes base reutilizáveis
  features/        Domínio, parser, app inventory, fixtures e contratos por feature
  lib/             Integrações e utilitários
  styles/          Tokens e CSS global
  types/           Tipos compartilhados
public/
  icons/           Assets PWA temporários
  sw.js            Service worker mínimo
e2e/               Testes E2E dos fluxos principais
scripts/           Automação local de validação, incluindo runner E2E
supabase/
  migrations/      Schema SQL versionado
```

O domínio foi mantido pequeno de propósito. Ele cobre `products`, `product_aliases`, `packaging_conversions`, `packaging_aliases`, `lots`, `inventory_movements` e `vocabulary_terms` sem adicionar módulos de ERP.

## Interface

A tela principal está em `src/features/inventory/app/InventoryApp.tsx`. Ela é mobile-first, em pt-BR, usa Iconoir e mantém o visual minimalista/glass definido na fundação.

Fluxo obrigatório:

```txt
texto digitado -> parser -> confirmação -> execução -> histórico
```

Mesmo interpretações `READY` exigem confirmação explícita. Ambiguidades de produto/lote são apresentadas como escolhas antes de liberar o botão de confirmar.

A UI atual cobre:

- lista de lotes ativos ordenada por FEFO;
- filtros `Todos`, `Até 7 dias`, `Até 30 dias` e `Vencidos`;
- composer fixo com safe area para nova movimentação;
- confirmação de entrada, saída e zeramento;
- cadastro manual simples de lote;
- edição de quantidade/produto/validade com movimento `ADJUSTMENT`;
- histórico geral e histórico do lote;
- toasts e mensagens amigáveis de erro.

Sem Supabase real, a interface usa o adapter local em `src/features/inventory/app/local-inventory-store.ts`, persistindo dados de desenvolvimento no `localStorage`. A UI consome esse contrato para permitir troca futura por um repositório Supabase sem misturar parsing, execução e componentes.

## Domínio

- Produtos possuem aliases próprios.
- Conversões pertencem ao produto; `fardo = 6` para um produto não vale para outro.
- Lotes são independentes e usam `expirationDate` como data civil.
- FEFO é o padrão para sugerir saída quando o lote não foi informado.
- Movimentações são separadas de parsing e preservam histórico com antes/depois.
- Parsing nunca altera estoque; execução só deve ocorrer depois de confirmação.

## Parser sem IA

O parser está em `src/features/inventory/parser`. Ele usa normalização PT-BR, vocabulário, aliases e regras determinísticas.

Status possíveis:

- `READY`: interpretação completa para a UI pedir confirmação.
- `NEEDS_CONFIRMATION`: falta confirmação ou há sugestão FEFO/data abreviada.
- `AMBIGUOUS`: há mais de um candidato relevante.
- `INVALID`: ação impossível ou dados inválidos.

Exemplos cobertos por testes:

```txt
Chegou 20 fardos de Coca 2L vence 10/10/2027
Vendeu 3 fardos da Coca 2L
Saíram 18 unidades de Coca 2L
Zerou a Coca 2L
Vendeu tudo da Coca 2 litros
```

Para adicionar expressão operacional, edite `operationalVocabulary` em `src/features/inventory/parser/vocabulary.ts` e acrescente testes. Para novo alias de produto ou embalagem, persista o alias no banco futuramente e mantenha fixtures/testes locais quando necessário.

## Datas

Validade é tratada como data civil (`DATE` no banco), não como instante UTC. Isso evita que `10/10` vire `09/10` por conversão de timezone.

Anos abreviados são expandidos por regra central em `expandTwoDigitExpirationYear`: `27` vira `2027`. A regra está testada e deve permanecer explícita.

## Instalação

```bash
npm ci
```

## Desenvolvimento local

```bash
npm run dev
```

O app abre por padrão em `http://localhost:3000`.

## Comandos

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run check
```

`npm run test:e2e` inicia o Next localmente, roda Playwright em Mobile Safari e Desktop Chromium, e encerra o servidor ao final.

## Variáveis de ambiente

Copie `.env.example` para um arquivo local não versionado quando houver um projeto Supabase real.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use apenas chave pública/publicável no frontend. Nunca exponha `service_role` ou tokens administrativos no browser.

## Supabase

A integração está preparada em `src/lib/supabase`. Sem variáveis públicas, o app continua buildando e a função de cliente retorna `null`.

O schema versionado está em `supabase/migrations/20260902190000_inventory_core.sql`.

Ele cria:

- `products`
- `product_aliases`
- `packaging_conversions`
- `packaging_aliases`
- `lots`
- `inventory_movements`
- `vocabulary_terms`

Também inclui constraints de integridade, índices para aliases/FEFO/histórico e a função `inventory_apply_lot_movement` para atualização atômica futura de lote + movimento.

Quando houver um projeto Supabase real, gere os tipos oficiais e compare com `src/types/database.ts`.

## PWA

A fundação inclui:

- `manifest.webmanifest` gerado por `src/app/manifest.ts`
- viewport com `viewport-fit=cover`
- suporte a safe areas no CSS
- `display: standalone`
- service worker mínimo em `public/sw.js`
- ícone SVG técnico em `public/icons/pwa-icon.svg`

Antes do lançamento público, substitua o ícone técnico por assets finais e adicione PNGs para Apple touch icon e Android maskable icon.

## Design system

A base visual está em `src/styles/globals.css`:

- Inter via `@fontsource-variable/inter`
- tokens de cor, raio, sombra e glass
- componentes base: `Button`, `IconButton`, `Input`, `Badge`, `GlassCard`, `Container`
- estados discretos: normal, atenção, urgente, vencido e informação

Mantenha Iconoir como fonte principal de ícones. Não substitua silenciosamente por Lucide, Heroicons, Font Awesome ou similares.

## Testes

Os testes principais estão junto do domínio/parser:

- `src/features/inventory/parser/parse-command.test.ts`
- `src/features/inventory/domain/dates.test.ts`
- `src/features/inventory/domain/fefo.test.ts`
- `src/features/inventory/domain/movements.test.ts`
- `src/features/inventory/app/InventoryApp.test.tsx`
- `e2e/app.spec.ts`

Para adicionar novo tipo de embalagem, crie conversão no produto, aliases correspondentes e teste ao menos uma entrada e uma saída.

## Próximos passos

1. Conectar projeto Supabase real e aplicar migrations.
2. Gerar tipos oficiais do Supabase.
3. Implementar repositório Supabase real mantendo o contrato do adapter local.
4. Preparar OCR/câmera, notificações e recursos da Etapa 4 sem adicionar IA ao parser determinístico.
