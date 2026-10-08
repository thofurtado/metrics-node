#Atlas do Metrics

Todas as tabelas do Metrics, divididas em módulos: o que cada uma guarda, como se ligam, quem grava e quem lê. Os desenhos saem direto do código (Prisma da nuvem, modelos do PDV e banco master do SaaS); o que só as pessoas sabem fica nos arquivos de cada módulo.

Gerado em 08/10/2026. Abra `atlas.html` no navegador para ver os desenhos e o manual.

| Módulo | Tabelas | Arquivo |
|---|---|---|
| Caixa e vendas | 14 | [caixa-vendas.md](caixa-vendas.md) |
| Mesas e salão | 4 | [mesas.md](mesas.md) |
| Delivery e pedidos online | 6 | [delivery.md](delivery.md) |
| Cardápio e produtos | 16 | [cardapio.md](cardapio.md) |
| Estoque e compras | 10 | [estoque.md](estoque.md) |
| Financeiro | 19 | [financeiro.md](financeiro.md) |
| Clientes | 5 | [clientes.md](clientes.md) |
| Ordens de serviço | 7 | [servicos.md](servicos.md) |
| RH e ponto | 7 | [rh.md](rh.md) |
| Fiscal (NFC-e) | 3 | [fiscal.md](fiscal.md) |
| Empresa, usuários e configuração | 9 | [empresa.md](empresa.md) |
| SaaS (banco master) | 2 | [saas.md](saas.md) |

## Ligações entre módulos (por chave)


## Como atualizar

1. Mudou tabela ou coluna no código: rode `atlas.py tudo` (skill metrics-atlas).
2. Aprendeu algo sobre uma tabela, regra ou função: edite `modulos/<id>.json` e rode `atlas.py gerar`.
3. Não edite `atlas.html`, `README.md` nem os `.md` dos módulos à mão: são gerados.

## O que falta no atlas e manual

- **6 tabela(s) sem módulo: pdv:ContadorNfce, pdv:ContadorSenhaDiaria, pdv:GarcomIdempotencia, pdv:ImpressaoItem, pdv:ImpressoraEstado, pdv:RegistroOperacao**
