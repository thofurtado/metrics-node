# Clientes

> Gerado por `atlas.py` em 25/09/2026 a partir do código e de `modulos/clientes.json`. Não edite este arquivo: edite o JSON do módulo e rode `atlas.py gerar`.

Cadastro de clientes e endereços, usado no delivery, no fiado e nas ordens de serviço.

## Cliente · `clients` (nuvem)

- **O que é:** Cadastro do cliente (nome, telefone, documento, e-mail).
- **Espelho:** Cliente (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `identification` | String (único) | não |  |  |
| `phone` | String | não |  |  |
| `email` | String | não |  |  |
| `contract` | Boolean | sim |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `contact` | String | não |  |  |
| `isEnterprise` | Boolean | sim |  |  |
| `group_id` | String | não | Grupo de clientes (Clientes) |  |

## Endereço · `addresses` (nuvem)

- **O que é:** Endereços do cliente, com o principal marcado.
- **Espelho:** Endereço (PDV)

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `client_id` | String | sim | Cliente (Clientes) |  |
| `street` | String | sim |  |  |
| `number` | String | sim |  |  |
| `neighborhood` | String | sim |  |  |
| `city` | String | sim |  |  |
| `state` | String | sim |  |  |
| `zipcode` | String | não |  |  |
| `complement` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |
| `is_main` | Boolean | sim |  |  |

## Grupo de clientes · `client_groups` (nuvem)

- **O que é:** Agrupamento de clientes com usuário e chave de VPN (Headscale).
- **Atenção:** A confirmar: parece do suporte remoto (Windy), não do restaurante.

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | String (chave) | sim |  |  |
| `name` | String | sim |  |  |
| `description` | String | não |  |  |
| `headscale_user` | String | não |  |  |
| `vpn_preauth_key` | String | não |  |  |
| `created_at` | DateTime | sim |  |  |
| `updated_at` | DateTime | sim |  |  |

## Cliente (PDV) · `clientes` (PDV)

- **O que é:** Cópia local, mais o saldo devedor do fiado e o limite de crédito. Cliente cadastrado no PDV sobe para a nuvem (voltou a subir no 2.4.19.0).
- **Espelho:** Cliente

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `telefone` | string | sim |  |  |
| `nome` | string | sim |  |  |
| `data_cadastro` | DateTime | sim |  |  |
| `cpf_cnpj` | string | não |  |  |
| `email` | string | não |  |  |
| `sincronizado_web` | bool | sim |  |  |
| `sync_tentativas` | int | sim |  |  |
| `sync_ultimo_erro` | string | não |  |  |
| `sync_proxima_tentativa` | DateTime | não |  |  |
| `limite_credito` | decimal | não |  |  |
| `saldo_devedor` | decimal | sim |  |  |
| `endereco_principal_id` | int | não | Endereço (PDV) (Clientes) |  |

## Endereço (PDV) · `enderecos_cliente` (PDV)

- **O que é:** Endereços do cliente no PDV.
- **Espelho:** Endereço

| Coluna | Tipo | Obrigatória | Liga com | Nota |
|---|---|---|---|---|
| `id` | int (chave) | sim |  |  |
| `uuid` | Guid | sim |  |  |
| `cliente_id` | int | sim | Cliente (PDV) (Clientes) |  |
| `logradouro` | string | sim |  |  |
| `numero` | string | sim |  |  |
| `bairro` | string | sim |  |  |
| `complemento` | string | não |  |  |
| `cidade` | string | sim |  |  |
| `estado` | string | sim |  |  |
| `cep` | string | não |  |  |
| `sincronizado_web` | bool | sim |  |  |
| `padrao` | bool | sim |  |  |

## Do PDV para a nuvem

| No PDV | Na nuvem | Como se ligam |
|---|---|---|
| Cliente (PDV) | Cliente | Mesmo código; sobe e desce a cada ciclo (o download sobrescreve o saldo devedor local). |
| Endereço (PDV) | Endereço | Sobe junto com o cliente (só o principal). |

## Ligações com outros módulos

- Equipamento (Ordens de serviço) `client_id` → Cliente
- Fiado (Caixa e vendas) `client_id` → Cliente
- Lançamento do caixa (Caixa e vendas) `client_id` → Cliente
- Ordem de serviço (Ordens de serviço) `client_id` → Cliente
- Pagamento (PDV) (Caixa e vendas) `cliente_id` → Cliente (PDV)
- Pedido (PDV) (Caixa e vendas) `cliente_id` → Cliente (PDV)
- Pedido (PDV) (Caixa e vendas) `endereco_entrega_id` → Endereço (PDV)
