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
- O parser da Etapa 2 é determinístico; não adicione API de IA para interpretação de comandos.
- Prefira decisões técnicas reversíveis sem pedir aprovação.

## Arquitetura

- Use Next.js, App Router, React e TypeScript strict.
- Mantenha código em `src/` com separação simples entre `app`, `components`,
  `features`, `lib`, `styles` e `types`.
- Evite abstrações prematuras e pastas vazias.
- Evite dependências novas quando a plataforma ou o código local resolvem bem.
- Para alterações futuras de banco, atualize `firestore.rules`, `firestore.indexes.json` e a documentação quando necessário.
- Preserve a separação: texto -> parser -> intenção -> confirmação -> execução.
- Parsing nunca deve alterar estoque ou banco.
- A UI nunca deve alterar estoque sem confirmação explícita, mesmo quando o parser retorna `READY`.
- A interface principal consome `src/features/inventory/app/local-inventory-store.ts` enquanto não houver Firebase real; preserve o contrato ao evoluir adapters reais.
- Com Firebase real, o app usa o workspace compartilhado `inventory/shared` para que várias pessoas vejam o mesmo estoque em tempo real.
- Preserve snapshots realtime no adapter Firestore; a UI deve refletir alterações feitas em outro dispositivo sem recarregar.
- O workspace compartilhado com Auth anônimo é uma solução simples para operação interna; se houver exigência de acesso restrito, implemente login real e regras por usuário/equipe.
- Conversões de embalagem pertencem ao produto. Nunca assuma multiplicadores globais.
- Validades são datas civis (`DATE`), não instantes UTC.
- FEFO deve sugerir lote sem esconder ambiguidade da UI.
- Regras de FEFO, conversão, quantidade e validade pertencem ao domínio/parser, não aos componentes React.
- Alertas devem usar `src/features/inventory/notifications/alerts.ts` e registrar marcos emitidos para evitar spam.
- Firebase real deve usar Firestore com transações para saída/zeramento/ajuste; não faça atualização ingênua de estoque no frontend.
- Regras do Firestore ficam em `firestore.rules`; índices ficam em `firestore.indexes.json`.
- Catálogo/base inicial fica em `src/features/inventory/fixtures/dev-catalog.ts`; ao adicionar produtos fixos do negócio, mantenha aliases e conversões testados.

## Design system

- Priorize mobile-first, iPhone/iPad e safe areas.
- Preserve o visual minimalista, suave, contemporâneo e inspirado em iOS.
- Preserve a identidade de vidro óptico: transparência perceptível, reflexos discretos nas bordas e contraste suficiente. Os tokens de aparência ficam em `src/styles/glass.css`.
- Temas claro/escuro são selecionáveis em `ThemeSwitcher`, persistidos por aparelho e aplicados antes da primeira pintura pelo bootstrap. Sem escolha salva, siga o sistema.
- Preserve o fundo local `public/images/glass-calendar.webp` e os fallbacks para movimento/transparência reduzidos e ausência de backdrop-filter. Não adicione animações contínuas caras.
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
- Não habilite banco de produção aberto; preserve regras do Firestore e documente pendências de autenticação.

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
- Evite aliases soltos perigosos: se um termo pode apontar para 2L e lata, retorne ambiguidade ou exija o formato.

## Interface e fluxos

- A tela principal fica em `src/features/inventory/app/InventoryApp.tsx`.
- O adapter local persiste dados de desenvolvimento no `localStorage`; não dependa de Firebase para build/test.
- Entrada, saída, zeramento e ajuste manual devem registrar `inventory_movements`.
- Ambiguidades de produto/lote devem ser resolvidas visualmente antes da confirmação.
- Testes de fluxo ficam em `src/features/inventory/app/InventoryApp.test.tsx` e `e2e/app.spec.ts`.
- `npm run test:e2e` usa `scripts/run-e2e.mjs` para iniciar e encerrar o Next corretamente no Windows.
- O fluxo de avisos fica em `AlertsSheet`: alertas internos sempre ativos, Web Push apenas após ação explícita. Preferências e entregas são por aparelho, nunca globais.
- Fotos/OCR foram removidos por decisão do usuário. Não reintroduzir.
- Push usa Netlify Scheduled Functions + Web Push. Credenciais administrativas e VAPID privadas ficam apenas no servidor.
- Preserve deduplicação por aparelho/lote/validade/marco e lembretes diários de vencidos.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
