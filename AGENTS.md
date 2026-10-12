# AGENTS.md - Guia Operacional do Projeto SaintPharma App

Este arquivo orienta agentes e desenvolvedores que trabalham neste repositório.

## 1) Visão Geral

- Projeto: `saintpharma-app`
- Plataforma: React Native com Expo (Expo Router)
- Linguagem: TypeScript (`strict: true`)
- UI: NativeWind (Tailwind no React Native)
- Autenticação: Clerk (`@clerk/clerk-expo`)
- Estado global: Zustand (`stores/`)
- Cliente HTTP principal: `services/httpClient.ts` (Axios)

Objetivo do app:
- Exibir cursos/aulas/provas/certificados
- Gerenciar onboarding de usuário
- Gerenciar ranking e sistema de vidas

## 2) Setup e Execução

## Pré-requisitos

- Node.js e npm
- Android Studio (para Android nativo)
- Java 17 no ambiente Android
- EAS CLI (para build em nuvem)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Use `.env` na raiz (não commitar):

```env
API_BASE_URL=https://www.saintpharmacursos.com.br
API_TOKEN=seu-token-aqui
CLERK_PUBLISHABLE_KEY=pk_live_ou_pk_test...
```

Observações importantes:
- `app.config.ts` carrega o `.env` com `dotenv` e injeta em `expoConfig.extra`.
- No código, use `utils/env.ts` (`getApiBaseUrl`, `getApiToken`, `getClerkPublishableKey`, etc.).
- Evite uso direto de `process.env` em telas/componentes.

## Comandos principais

```bash
npm run start          # expo start
npm run android:run    # expo run:android
npm run web:run        # expo start --web
npm run lint           # expo lint
npm run typecheck      # tsc --noEmit
```

## Build EAS

- Perfis definidos em `eas.json`: `apk`, `production`, `preview`
- Configure as variáveis necessárias no EAS (não colocar valores em `eas.json`).
- `CLERK_SECRET_KEY` é exclusiva do servidor; nunca a injete no app móvel.
- `API_TOKEN` é embutido no cliente móvel pelo código atual, portanto pode ser extraído do APK. Não o trate como segredo nem como autenticação de usuário; as rotas devem validar uma sessão Clerk no servidor.

## 3) Estrutura do Projeto

- `app/`: rotas (Expo Router)
- `components/`: componentes reutilizáveis
- `services/`: integração com API e regras de acesso HTTP
- `stores/`: estado global e providers
- `hooks/`: hooks de autenticação/onboarding/verificações
- `types/`: contratos TypeScript
- `utils/`: helpers (env, temas, utilitários)
- `docs/`: documentação interna de fluxos e APIs

## Rotas relevantes

- `app/_layout.tsx`: providers globais (`ThemeProvider`, `ClerkProvider`, `LivesProvider`)
- `app/(auth)/`: fluxo de login/cadastro
- `app/(tabs)/`: área principal autenticada
- `app/onboarding.tsx`: onboarding de perfil
- `app/sso-callback.tsx`: callback de SSO/deep link

## 4) Regras de Implementação

## Imports e paths

- Preferir alias `@/` (configurado em `tsconfig.json` e `babel.config.js`)
- Evitar imports relativos longos (`../../../../`)

## Tipagem

- Sempre tipar retorno de serviços e payloads com interfaces em `types/`
- Não usar `any` sem justificativa clara
- Em novos endpoints, criar/atualizar tipos em `types/api.ts`

## API e serviços

- Priorizar `httpClient` (`services/httpClient.ts`) para novas integrações
- Manter padrão de headers:
  - `Authorization: Bearer <API_TOKEN>`
  - `X-User-Id` quando autenticado (configurado via `httpClient.setUserId`)
- Centralizar tradução de erros no client/service, não nas telas
- Não duplicar lógica de chamada HTTP em componentes

## Estado global

- Tema: `stores/themeStore.ts`
- Vidas: `stores/livesStore.ts` + `stores/LivesProvider.tsx`
- Para estado compartilhado novo, preferir store dedicada em `stores/`

## Autenticação e onboarding

- Auth é Clerk-first (não implementar auth manual paralela)
- Qualquer mudança de auth deve preservar:
  - redirecionamento correto em `app/(auth)/_layout.tsx`
  - validação de onboarding (`hooks/useOnboardingCheck.ts`)
  - callback SSO (`app/sso-callback.tsx`)

## UI e estilo

- Usar classes NativeWind já adotadas no projeto
- Reaproveitar componentes existentes antes de criar novos
- Manter consistência visual com tema claro/escuro (`utils/themes.ts`)

## Logs

- Logs atuais são detalhados para diagnóstico; evitar remover sem motivo
- Para novos logs, seguir prefixo por contexto (ex.: `[UserService]`, `[HttpClient]`)
- Não logar segredos/tokens

## 5) Fluxos Críticos (não quebrar)

## A) Inicialização da app

1. `app/_layout.tsx` sobe providers
2. Clerk carrega sessão
3. Tabs verificam onboarding
4. Usuário segue para home ou `/onboarding`

## B) Onboarding

- Verificação principal em `hooks/useOnboardingCheck.ts`
- Regras e integração em `services/onboarding.ts`
- Alterações nesse fluxo exigem teste manual de:
  - usuário novo
  - usuário existente
  - erro de API / 404

## C) Sistema de vidas

- API fonte da verdade; AsyncStorage como fallback/cache
- Operações de perda/sincronização em `stores/livesStore.ts` e `stores/LivesProvider.tsx`
- Mudanças devem validar sincronização + regeneração

## D) SSO/Deep Link

- Scheme: `saintpharma-app`
- Callback esperado: `saintpharma-app://sso-callback`
- Mudanças de SSO exigem validar Clerk Dashboard + rota de callback

## 6) Segurança e Segredos

- Nunca commitar `.env`
- Nunca hardcode de tokens/chaves em código
- Nunca expor `API_TOKEN`/`CLERK_SECRET_KEY` em logs, prints ou docs públicas
- `CLERK_SECRET_KEY` deve permanecer apenas no servidor
- `API_TOKEN` está atualmente embutido no APK e precisa ser substituído por autenticação de usuário validada pelo servidor

## 7) Checklist Antes de Entregar Mudanças

Execute:

```bash
npm run lint
npm run typecheck
```

Validar manualmente quando aplicável:
- Fluxo de login/cadastro
- Redirecionamento de onboarding
- Telas principais das tabs
- Chamadas API alteradas
- Android run (`npm run android:run`) se mudança nativa/roteamento profundo

## 8) Decisões de Manutenção

- Para código novo, preferir `services/*Service.ts` em vez de crescer `services/api.ts`.
- Sempre que adicionar endpoint:
  1. Atualize tipos em `types/api.ts`
  2. Crie/atualize service dedicado
  3. Documente em `docs/routes/...` quando for rota nova/importante
- Evitar alterações em massa de estilo sem necessidade funcional.

## 9) Documentação Interna Importante

- `ENV_SETUP.md`
- `docs/ANDROID_RUN_AND_EAS_BUILD.md`
- `docs/SSO_SETUP_GUIDE.md`
- `docs/ONBOARDING_IMPLEMENTATION.md`
- `docs/CLERK_USER_CREATION_PROCESS.md`
- `docs/routes/README.md`

## 10) Convenções de Colaboração

- Mudanças pequenas e focadas por PR/commit
- Não misturar refactor amplo com correção funcional crítica
- Se houver divergência entre docs e código, priorizar o código atual e atualizar a documentação na mesma entrega
