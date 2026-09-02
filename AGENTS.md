# AGENTS.md

## Contexto do produto

Controle de Validades é uma PWA mobile-first para controlar produtos, lotes,
quantidades restantes, unidades/embalagens, conversões e datas de validade.

A pergunta central do produto é: **o que tenho, quanto tenho e o que está perto
de vencer?**

O app deve continuar pequeno e direto. Não transforme este projeto em ERP.

## Regras de escopo

- Priorize validade, lotes, estoque restante, conversões e histórico.
- Não adicione financeiro, CMV, fiscal, folha, vendas completas ou fornecedor complexo.
- Não implemente IA, OCR, câmera, notificações reais ou parser completo antes da etapa correspondente.
- O parser da Etapa 2 é determinístico; não adicione API de IA para interpretação de comandos.
- Prefira decisões técnicas reversíveis sem pedir aprovação.

## Arquitetura

- Use Next.js, App Router, React e TypeScript strict.
- Mantenha código em `src/` com separação simples entre `app`, `components`,
  `features`, `lib`, `styles` e `types`.
- Evite abstrações prematuras e pastas vazias.
- Evite dependências novas quando a plataforma ou o código local resolvem bem.
- Para alterações futuras de banco, use migrations.
- Preserve a separação: texto -> parser -> intenção -> confirmação -> execução.
- Parsing nunca deve alterar estoque ou banco.
- A UI nunca deve alterar estoque sem confirmação explícita, mesmo quando o parser retorna `READY`.
- A interface principal consome `src/features/inventory/app/local-inventory-store.ts` enquanto não houver Supabase real; preserve o contrato ao criar adapters reais.
- Conversões de embalagem pertencem ao produto. Nunca assuma multiplicadores globais.
- Validades são datas civis (`DATE`), não instantes UTC.
- FEFO deve sugerir lote sem esconder ambiguidade da UI.
- Regras de FEFO, conversão, quantidade e validade pertencem ao domínio/parser, não aos componentes React.

## Design system

- Priorize mobile-first, iPhone/iPad e safe areas.
- Preserve o visual minimalista, suave, contemporâneo e inspirado em iOS.
- Use glassmorphism com moderação e contraste suficiente.
- Preserve tokens de design antes de criar estilos pontuais.
- Use Iconoir como biblioteca principal de ícones.
- Não substitua silenciosamente Iconoir por Lucide, Heroicons, Font Awesome ou emojis permanentes.
- A UI deve permanecer em português brasileiro, com datas em `DD/MM/YYYY`.
- Mantenha composer, sheets e controles compatíveis com safe areas e toque em iPhone/iPad.
- Evite aparência de dashboard/ERP; a primeira tela deve responder rapidamente validade, quantidade e lote prioritário.

## Segurança

- Nunca commite secrets.
- Nunca coloque Service Role Key ou tokens administrativos no frontend.
- Mantenha `.env*` sensível fora do Git.
- `.env.example` deve conter apenas nomes e valores fictícios.

## Qualidade obrigatória

Antes de concluir qualquer tarefa relevante, rode e corrija:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Também confira `git status` e atualize a documentação quando arquitetura,
configuração ou comandos mudarem.

## Parser e vocabulário

- Vocabulário operacional fica em `src/features/inventory/parser/vocabulary.ts`.
- Normalização PT-BR fica em `src/features/inventory/parser/normalization.ts`.
- Datas ficam em `src/features/inventory/domain/dates.ts`; anos abreviados usam regra central.
- Produto, embalagem ou lote ambíguo deve retornar `AMBIGUOUS` ou `NEEDS_CONFIRMATION`.
- Para novas expressões, aliases ou embalagens, atualize testes reais em `src/features/inventory`.

## Interface e fluxos

- A tela principal fica em `src/features/inventory/app/InventoryApp.tsx`.
- O adapter local persiste dados de desenvolvimento no `localStorage`; não dependa de Supabase para build/test.
- Entrada, saída, zeramento e ajuste manual devem registrar `inventory_movements`.
- Ambiguidades de produto/lote devem ser resolvidas visualmente antes da confirmação.
- Testes de fluxo ficam em `src/features/inventory/app/InventoryApp.test.tsx` e `e2e/app.spec.ts`.
- `npm run test:e2e` usa `scripts/run-e2e.mjs` para iniciar e encerrar o Next corretamente no Windows.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
