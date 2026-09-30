# Fiscal (NFC-e)

> Gerado por `atlas.py` em 29/09/2026 a partir do código e de `modulos/fiscal.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

## Para que serve

A NFC-e é emitida só pelo PDV: o XML de cada nota, a inutilização de numeração e a tabela do IBPT (valor aproximado dos tributos) ficam no banco local. Os dados fiscais do produto (NCM, CFOP, CSOSN) ficam no cardápio.

## Tabelas e Estrutura de Dados

### XML da NFC-e (`nfce_documentos`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Cópia do XML de cada nota (autorizada, contingência, cancelamento). O arquivo também fica em C:\ProgramData\Metrics.PDV\nfce.
- **Quem lê:** Reimpressão, ZIP para o contador.

### Inutilização (`nfce_inutilizacoes`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Faixas de numeração da NFC-e inutilizadas na SEFAZ.

### Tabela do IBPT (`ibpt_tabela`)

- **Origem:** PDV local (Metrics.PDV)
- **O que é:** Percentual aproximado de tributos por NCM, importado do CSV oficial do IBPT (um por estado). Cada importação troca a tabela inteira.
- **Cresce:** Milhares de linhas, substituídas a cada importação.

## Pendências e decisões

- A nota não sobe para a nuvem: a venda da nuvem não guarda chave nem número da NFC-e.
