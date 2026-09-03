# Controle de Validades

PWA mobile-first para responder uma pergunta simples: **o que tenho, quanto tenho e o que está perto de vencer?**

O projeto já possui fundação PWA, domínio/parser determinístico, interface principal de movimentações, OCR local de validade, alertas internos e adapter Supabase preparado. Ainda não implementa IA nem autenticação complexa.

## Stack

- Next.js com App Router
- React + TypeScript strict
- Supabase JS SDK preparado, sem depender de credenciais reais
- Iconoir como biblioteca principal de ícones
- Tesseract.js carregado sob demanda para OCR no navegador
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
- leitura de validade por câmera/arquivo com confirmação e correção;
- alertas internos e preferências de aviso;
- toasts e mensagens amigáveis de erro.

Sem Supabase real, a interface usa o adapter local em `src/features/inventory/app/local-inventory-store.ts`, persistindo dados de desenvolvimento no `localStorage`. A UI consome esse contrato para permitir troca futura por um repositório Supabase sem misturar parsing, execução e componentes.

## Câmera e OCR

O fluxo `Ler validade` usa `input type="file" accept="image/*" capture="environment"` para abrir câmera no mobile e seletor de imagem no desktop.

O OCR fica em `src/features/inventory/ocr`:

- `browser-ocr.ts` carrega `tesseract.js` somente quando o usuário escolhe uma imagem;
- a imagem é pré-processada no navegador com canvas simples e descartada após leitura;
- nenhuma foto é enviada para APIs pagas ou serviços de IA;
- `expiration-date-extraction.ts` reutiliza a regra de datas civis do domínio.

Quando há múltiplas datas, a UI mostra opções. A validade detectada sempre exige confirmação e pode ser corrigida manualmente antes de preencher o cadastro de lote.

## Alertas

Alertas ficam em `src/features/inventory/notifications`.

- Preferências padrão: 30, 15, 7 dias e no vencimento.
- O app registra marcos já emitidos para evitar repetição.
- Lotes zerados/encerrados não geram alertas.
- O alerta interno funciona sempre ao abrir o app.
- Notificações do navegador só são solicitadas após o usuário tocar em `Ativar avisos`.

Limitação real: PWAs não têm push/background confiável em todos os navegadores sem backend de push. Por isso, a versão atual usa Notification API quando disponível e mantém alertas internos como degradação segura.

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

`npm run test:e2e` inicia o Next localmente, roda Playwright em Mobile Safari, Mobile Chrome e Desktop Chromium, e encerra o servidor ao final.

## Variáveis de ambiente

Copie `.env.example` para um arquivo local não versionado quando houver um projeto Supabase real.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use apenas chave pública/publicável no frontend. Nunca exponha `service_role` ou tokens administrativos no browser.

## Supabase

A integração está preparada em `src/lib/supabase`. Sem variáveis públicas, o app continua buildando e a função de cliente retorna `null`.

Os schemas versionados ficam em `supabase/migrations`.

Ele cria:

- `products`
- `product_aliases`
- `packaging_conversions`
- `packaging_aliases`
- `lots`
- `inventory_movements`
- `vocabulary_terms`

Também inclui constraints de integridade, índices para aliases/FEFO/histórico e a função `inventory_apply_lot_movement` para atualização atômica futura de lote + movimento.

A migration final adiciona:

- `notification_preferences`
- `notification_deliveries`
- RPC `inventory_create_entry_lot`
- RPC `inventory_adjust_lot`
- RLS habilitado com políticas para usuários autenticados

Sem credenciais reais, o app continua operando com adapter local. Com Supabase real, aplique migrations, gere tipos oficiais e conecte a UI ao repositório em `src/features/inventory/repositories/supabase-inventory-repository.ts`.

Quando houver um projeto Supabase real, gere os tipos oficiais e compare com `src/types/database.ts`.

## PWA

A fundação inclui:

- `manifest.webmanifest` gerado por `src/app/manifest.ts`
- viewport com `viewport-fit=cover`
- suporte a safe areas no CSS
- `display: standalone`
- service worker em `public/sw.js`
- ícones SVG/PNG para manifest, maskable Android e Apple touch icon
- metadata Apple Web App e status bar translúcida

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
- `src/features/inventory/notifications/alerts.test.ts`
- `src/features/inventory/ocr/expiration-date-extraction.test.ts`
- `src/features/inventory/app/InventoryApp.test.tsx`
- `e2e/app.spec.ts`

Para adicionar novo tipo de embalagem, crie conversão no produto, aliases correspondentes e teste ao menos uma entrada e uma saída.

## Próximos passos

1. Conectar projeto Supabase real e aplicar migrations quando houver credenciais/autenticação.
2. Gerar tipos oficiais do Supabase.
3. Decidir modelo de autenticação antes de usar RLS em produção multiusuário.
4. Evoluir push/background se houver backend de notificações.
