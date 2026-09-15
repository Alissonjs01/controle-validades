# Controle de Validades

PWA mobile-first para responder uma pergunta simples: **o que tenho, quanto tenho e o que está perto de vencer?**

O projeto já possui fundação PWA, domínio/parser determinístico, interface principal de movimentações, OCR local de validade, alertas internos e adapter Firebase/Firestore em produção. Ainda não implementa IA nem login complexo.

## Stack

- Next.js com App Router
- React + TypeScript strict
- Firebase Web SDK com Firestore realtime, sem depender de credenciais reais em teste local
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
firestore.rules    Regras de acesso do Firestore
firebase.json      Configuração do Firebase CLI
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

Sem Firebase real, a interface usa o adapter local em `src/features/inventory/app/local-inventory-store.ts`, persistindo dados de desenvolvimento no `localStorage`. Quando as variáveis públicas do Firebase existem, o app usa o repositório Firestore em `src/features/inventory/repositories/firestore-inventory-repository.ts`, com snapshots em tempo real para refletir alterações feitas em outro celular, tablet ou navegador.

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
Chegou 2 fardos de Fanta Guaraná 2 L vence 10/10/2027
Chegou 1 fardo de Split Zero Lata vence 10/10/2027
```

O catálogo inicial reconhece Coca-Cola 2L, Coca-Cola Lata, Coca-Cola Zero Lata, Fanta Guaraná/Uva/Laranja 2L, Fanta Guaraná/Uva/Laranja Lata, Sprite Lata, Sprite Zero Lata, Suco Del Valle Uva/Laranja e Água Mineral 600ml. As conversões ficam por produto: 2L em fardo = 6 unidades, latas de refrigerante em fardo = 12 unidades e água 600ml em fardo/pacote = 12 unidades.

Para adicionar expressão operacional, edite `operationalVocabulary` em `src/features/inventory/parser/vocabulary.ts` e acrescente testes. Para novo alias de produto ou embalagem, atualize o catálogo/base no Firestore quando for dado fixo do negócio e mantenha fixtures/testes locais.

## Datas

Validade é tratada como data civil em string ISO (`YYYY-MM-DD`) no banco, não como instante UTC. Isso evita que `10/10` vire `09/10` por conversão de timezone.

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

Copie `.env.example` para um arquivo local não versionado quando houver um projeto Firebase real.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Essas chaves Web do Firebase são públicas por natureza. A proteção real fica em `firestore.rules`. Nunca coloque conta de serviço, tokens administrativos ou secrets privados no frontend.

## Firebase / Firestore

A integração está preparada em `src/lib/firebase`. Sem variáveis públicas, o app continua buildando e usa `localStorage`.

O banco oficial do projeto é Firestore. A estrutura atual usa o workspace compartilhado `inventory/shared` e subcoleções:

- `products`
- `packagingConversions`
- `lots`
- `inventoryMovements`
- `settings`
- `notificationDeliveries`

Entrada cria lote e movimento juntos. Saída, zeramento e ajuste usam `runTransaction` para ler o lote, aplicar a regra de domínio e gravar lote + histórico de forma consistente.

As regras ficam em `firestore.rules` e exigem usuário autenticado anônimo. Todos os dispositivos entram no workspace compartilhado para permitir acompanhamento em tempo real do mesmo estoque. Isso atende ao uso simples em equipe, mas não é controle de acesso forte: se o app precisar restringir usuários específicos, a próxima evolução deve adicionar login real e regras por usuário/equipe.

No Console do Firebase, mantenha habilitado:

- Firestore Database
- Authentication -> Anonymous

Publique regras/índices com Firebase CLI quando mudar segurança ou índices:

```bash
firebase deploy --only firestore
```

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

1. Validar no uso real se o workspace compartilhado atende à operação da equipe.
2. Adicionar login real e regras por usuário/equipe se o acesso precisar ser restrito.
3. Evoluir push/background se houver backend de notificações.
4. Ampliar catálogo e aliases conforme os produtos reais forem aparecendo.
