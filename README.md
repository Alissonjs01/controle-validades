# Controle de Validades

PWA mobile-first para responder uma pergunta simples: **o que tenho, quanto tenho e o que está perto de vencer?**

Esta etapa cria a fundação do aplicativo. O projeto ainda não implementa cadastro real de produtos, lotes, parser de linguagem natural, OCR, câmera, autenticação ou notificações.

## Stack

- Next.js com App Router
- React + TypeScript strict
- Supabase JS SDK preparado, sem depender de credenciais reais
- Iconoir como biblioteca principal de ícones
- CSS moderno com tokens próprios de design
- Vitest + Testing Library para testes unitários/de componentes
- Playwright preparado para E2E futuro
- GitHub Actions para CI

## Arquitetura

```txt
src/
  app/             Rotas, layout, manifest PWA
  components/      Componentes base reutilizáveis
  features/        Regras por domínio/feature
  lib/             Integrações e utilitários
  styles/          Tokens e CSS global
  types/           Tipos compartilhados
public/
  icons/           Assets PWA temporários
  sw.js            Service worker mínimo
e2e/               Base para testes E2E futuros
```

O domínio foi mantido pequeno de propósito. As próximas etapas devem introduzir `products`, `lots`, `inventory_movements`, `packaging_conversions`, `vocabulary` e `notification_preferences` sem adicionar módulos de ERP.

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
npm run build
npm run check
```

Também existe `npm run test:e2e` para a base Playwright. Instale os navegadores do Playwright quando a etapa que exigir E2E real for implementada.

## Variáveis de ambiente

Copie `.env.example` para um arquivo local não versionado quando houver um projeto Supabase real.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Use apenas chave pública/publicável no frontend. Nunca exponha `service_role` ou tokens administrativos no browser.

## Supabase

A integração está preparada em `src/lib/supabase`. Sem variáveis públicas, o app continua buildando e a função de cliente retorna `null`.

As próximas etapas devem adicionar migrations e tipos gerados do Supabase antes de implementar acesso real às tabelas.

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

## Próximos passos

1. Criar projeto Supabase, migrations e políticas.
2. Modelar tabelas de produtos, lotes, movimentos e conversões.
3. Gerar tipos do banco e substituir o placeholder em `src/types/database.ts`.
4. Implementar fluxos reais de cadastro/movimentação mantendo o escopo focado em validades.
