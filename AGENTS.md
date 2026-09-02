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
- Prefira decisões técnicas reversíveis sem pedir aprovação.

## Arquitetura

- Use Next.js, App Router, React e TypeScript strict.
- Mantenha código em `src/` com separação simples entre `app`, `components`,
  `features`, `lib`, `styles` e `types`.
- Evite abstrações prematuras e pastas vazias.
- Evite dependências novas quando a plataforma ou o código local resolvem bem.
- Para alterações futuras de banco, use migrations.

## Design system

- Priorize mobile-first, iPhone/iPad e safe areas.
- Preserve o visual minimalista, suave, contemporâneo e inspirado em iOS.
- Use glassmorphism com moderação e contraste suficiente.
- Preserve tokens de design antes de criar estilos pontuais.
- Use Iconoir como biblioteca principal de ícones.
- Não substitua silenciosamente Iconoir por Lucide, Heroicons, Font Awesome ou emojis permanentes.

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
npm run build
```

Também confira `git status` e atualize a documentação quando arquitetura,
configuração ou comandos mudarem.
