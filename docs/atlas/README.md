# Atlas do Metrics

Todas as tabelas do Metrics, divididas em módulos: o que cada uma guarda, como se ligam, quem grava e quem lê. Os desenhos saem direto do código (Prisma da nuvem, modelos do PDV e banco master do SaaS); o que só as pessoas sabem fica nos arquivos de cada módulo.

Gerado em 25/09/2026. Abra `atlas.html` no navegador para ver os desenhos.

| Módulo | Tabelas | Arquivo |
|---|---|---|
| Caixa e vendas | 12 | [caixa-vendas.md](caixa-vendas.md) |
| Mesas e salão | 4 | [mesas.md](mesas.md) |
| Delivery e pedidos online | 6 | [delivery.md](delivery.md) |
| Cardápio e produtos | 16 | [cardapio.md](cardapio.md) |
| Estoque e compras | 10 | [estoque.md](estoque.md) |
| Financeiro | 19 | [financeiro.md](financeiro.md) |
| Clientes | 5 | [clientes.md](clientes.md) |
| Ordens de serviço | 7 | [servicos.md](servicos.md) |
| RH e ponto | 6 | [rh.md](rh.md) |
| Fiscal (NFC-e) | 3 | [fiscal.md](fiscal.md) |
| Empresa, usuários e configuração | 8 | [empresa.md](empresa.md) |
| SaaS (banco master) | 2 | [saas.md](saas.md) |

## Ligações entre módulos (por chave)

- Estoque e compras → Cardápio e produtos: 6
- Caixa e vendas → Clientes: 5
- Caixa e vendas → Financeiro: 4
- Ordens de serviço → Clientes: 2
- Ordens de serviço → Empresa, usuários e configuração: 2
- Ordens de serviço → Estoque e compras: 2
- Ordens de serviço → Financeiro: 2
- Caixa e vendas → Ordens de serviço: 2
- Caixa e vendas → Cardápio e produtos: 2
- Caixa e vendas → Empresa, usuários e configuração: 2
- Ordens de serviço → Cardápio e produtos: 1
- Estoque e compras → Ordens de serviço: 1
- Estoque e compras → Caixa e vendas: 1
- Financeiro → Ordens de serviço: 1
- Financeiro → Estoque e compras: 1
- Financeiro → Caixa e vendas: 1
- RH e ponto → Empresa, usuários e configuração: 1
- RH e ponto → Financeiro: 1
- Caixa e vendas → Estoque e compras: 1
- Caixa e vendas → RH e ponto: 1
- Delivery e pedidos online → Cardápio e produtos: 1
- Estoque e compras → Financeiro: 1
- Estoque e compras → Empresa, usuários e configuração: 1
- Caixa e vendas → Mesas e salão: 1

## Como atualizar

1. Mudou tabela ou coluna no código: rode `atlas.py tudo` (skill metrics-atlas).
2. Aprendeu algo sobre uma tabela: edite `modulos/<id>.json` e rode `atlas.py gerar`.
3. Não edite `atlas.html`, `README.md` nem os `.md` dos módulos à mão: são gerados.
