# Empresa, usuários e configuração

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/empresa.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Usuários do sistema e seus módulos liberados, o perfil da empresa (White Label do cardápio, horários, setores de entrega) e as configurações gerais.

## Tabelas e Estrutura de Dados

### Usuário (`users`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quem faz login no sistema (web, PDV, app), com papel (ADMIN…).
- **Espelho no PDV/nuvem:** Usuário (PDV) (`users`)

### Módulo liberado (`modules`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Módulo do sistema que pode ser liberado para um usuário.

### Usuário × módulo (`user_modules`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Quais módulos cada usuário acessa.

### Perfil da empresa (`company_profiles`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Nome, contato, White Label do cardápio (tema, bairros, Pix), integrações.

### Horário de funcionamento (`business_hours`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Horários do cardápio online por dia da semana.

### Configuração do sistema (`system_configs`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Módulos ligados, fechamento cego, perfil financeiro, cartões do painel e integrações.

### Integrações do cliente (`tenant_integrations`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Uma linha por serviço de fora ligado pelo cliente em Configurações > Integrações: De Olho no Imposto (IBPT: token e CNPJ da empresa) e 99Food (id da loja). Criada em 25/09/2026.
- **Quem grava:** Web → Configurações > Integrações (o token do IBPT é testado no IBPT antes de salvar).
- **Quem lê:** PDV, pela rota /api/pdv/sync/ibpt (o backend consulta o IBPT com o token; o token nunca vai ao PDV) e a entrada de pedidos da 99Food (de qual cliente é a loja).
- **Cresce:** Uma linha por serviço: poucas linhas por cliente.

### Usuário (PDV) (`users`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia local dos usuários, baixada a cada ciclo (usuário que sumiu da nuvem é apagado do PDV).
- **Espelho no PDV/nuvem:** Usuário (`users`)

### Configuração (PDV) (`configuracoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Chave e valor das configurações do terminal (ex.: Fiscal.ValidacaoRigorosa, total de mesas).

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Usuário (PDV) | Usuário | Mesmo código; baixado a cada ciclo. |
