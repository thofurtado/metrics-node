# Ordens de serviço

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/servicos.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

Atendimento técnico: a ordem de serviço de um equipamento do cliente, os itens e serviços usados, o andamento e o pagamento.

## Tabelas e Estrutura de Dados

### Ordem de serviço (`treatments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Atendimento técnico de um cliente, ligado a um equipamento e a um responsável.

### Item da O.S. (`treatment_items`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Produto, insumo ou serviço usado na ordem de serviço (baixa estoque).

### Serviço (`services`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Serviço cobrado (mão de obra).

### Equipamento (`equipments`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Equipamento do cliente atendido.

### Andamento (`interactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Registro do andamento da ordem de serviço, por usuário.

### O.S. × lançamento (`treatment_transactions`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Liga a ordem de serviço aos lançamentos financeiros que ela gerou.

### Pagamento da O.S. (`payment_entries`)

- **Origem:** Nuvem (metrics-node)
- **O que é:** Forma de pagamento, parcelas e valor pagos na ordem de serviço.

## Pendências e decisões

- Descrições tiradas dos nomes e das ligações: confirmar com quem usa o módulo.
