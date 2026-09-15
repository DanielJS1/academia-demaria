# DOC-Academy

Este projeto foi reorganizado para separar a versão atual da demonstração antiga.

## Estrutura atual

- `platform/` — app principal em Next.js / React / TypeScript
- `.legacy/` — protótipo antigo preservado para consulta e referência
- `.gitignore` — regras locais do repositório

## Como trabalhar aqui

- Use `platform/` como área ativa de desenvolvimento.
- Use `.legacy/` apenas para referência histórica ou para recuperar trechos antigos.
- Não edite o legado enquanto estiver evoluindo a nova versão, a menos que você queira comparar comportamentos.

## Iniciar a nova plataforma

Na pasta `platform/`:

```powershell
pnpm install
pnpm dev
```

Abra:

- http://127.0.0.1:4174

## Observação

O legado ainda está disponível em `.legacy/`, mas foi movido para fora do caminho principal para evitar confusão durante o desenvolvimento do novo produto.

## Piloto com contas reais

A integração com Supabase está em `platform/`. Consulte [Ativar o piloto](platform/ATIVAR-PILOTO.md) antes do primeiro acesso. A migração e o administrador inicial precisam ser configurados no projeto Supabase.
