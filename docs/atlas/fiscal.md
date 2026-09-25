# Fiscal (NFC-e)

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/fiscal.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

A NFC-e é emitida só pelo PDV: o XML de cada nota, a inutilização de numeração e a tabela do IBPT (valor aproximado dos tributos) ficam no banco local. Os dados fiscais do produto (NCM, CFOP, CSOSN) ficam no cardápio.

## XML da NFC-e · `nfce_documentos` (PDV)

- **O que é:** Cópia do XML de cada nota (autorizada, contingência, cancelamento). O arquivo também fica em C:\ProgramData\Metrics.PDV\nfce.
- **Quem lê:** Reimpressão, ZIP para o contador.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `pedido_id` | int | não |  |  |
| `chave` | string | sim |  |  |
| `tipo` | string | sim |  |  |
| `ambiente` | string | sim |  |  |
| `xml` | string | sim |  |  |
| `criado_em` | DateTime | sim |  |  |

## Inutilização · `nfce_inutilizacoes` (PDV)

- **O que é:** Faixas de numeração da NFC-e inutilizadas na SEFAZ.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `ambiente` | string | sim |  |  |
| `serie` | int | sim |  |  |
| `numero_inicial` | int | sim |  |  |
| `numero_final` | int | sim |  |  |
| `justificativa` | string | sim |  |  |
| `protocolo` | string | não |  |  |
| `criado_em` | DateTime | sim |  |  |

## Tabela do IBPT · `ibpt_tabela` (PDV)

- **O que é:** Percentual aproximado de tributos por NCM, importado do CSV oficial do IBPT (um por estado). Cada importação troca a tabela inteira.
- **Cresce:** Milhares de linhas, substituídas a cada importação.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `ncm` | string | sim |  |  |
| `ex` | string | sim |  |  |
| `tipo` | int | sim |  |  |
| `descricao` | string | não |  |  |
| `nacional_federal` | decimal | sim |  |  |
| `importado_federal` | decimal | sim |  |  |
| `estadual` | decimal | sim |  |  |
| `municipal` | decimal | sim |  |  |
| `vigencia_inicio` | DateTime | não |  |  |
| `vigencia_fim` | DateTime | não |  |  |
| `chave` | string | não |  |  |
| `versao` | string | não |  |  |

## Pendências e decisões

- A nota não sobe para a nuvem: a venda da nuvem não guarda chave nem número da NFC-e.
