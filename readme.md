# Metrics

# RFs (Requisitos funcionais)

### Criação

> Minimo 

- [x] Deve ser possível cadastrar um usuário;
- [x] Deve ser possível se autenticar;
- [x] Deve ser possível obter o perfil de um usuário logado
- [x] Deve ser possível cadastrar uma conta
- [x] Deve ser possível cadastrar um setor
- [x] Deve ser possível criar uma transação
- [x] Deve ser possível criar uma transação de transferência
- [x] Deve ser possível obter todas as contas
- [x] Deve ser possível obter todos os setores
- [x] Deve ser possível obter todas as transações

> Meio caminho

- [x] Deve ser possível cadastrar um cliente
- [x] Deve ser possível cadastrar um endereço de cliente
- [x] Deve ser possível cadastrar um equipamento
- [] Deve ser possível cadastrar uma mercadoria
- [] Deve ser possível cadastrar uma movimentação de estoque
- [] Deve ser possível iniciar um atendimento
- [] Deve ser possivel cadastrar uma interação

# RNs (Regras de Negócio)

> Mínimo

- [x] Não deve ser possível cadastrar usuários com o mesmo email
- [x] Não deve ser possível cadastrar usuário com uma senha menor do que 6 digitos
- [x] Não deve ser possível autenticar o usuário com a senha incorreta
- [x] Não deve ser possível autenticar o usuário com o email incorreto
- [x] Não deve ser possível cadastrar uma conta com o mesmo nome
- [x] Não deve ser possível criar conta com saldo menor que 0
- [x] Não deve ser possível cadastrar um setor com o mesmo nome
- [x] Não deve ser possível cadastrar uma transação a menos que seja de um dos seguinte tipos: 
income, expense, transfer
- [x] Toda transação confirmada alteração no balanço da conta
- [x] Toda transação de transferência, altera o balanço da conta de origem e de destino
- [x] Toda transação de transferência, gera um registro de transferência


> meio caminho

- [] Não deve ser possível cadastra um cliente com o mesmo cpf/cnpj
- [] Não deve ser possível cadastra um cliente com cpf/cnpj invalido
- [] Não deve ser possível cadastra um cliente com telefone invalido
- [] Não deve ser possível cadastra um cliente com email 
- [] Não deve ser possível cadastrar um endereço com cliente inexistente
- [] Não deve ser possível cadastrar uma mercadoria com o mesmo nome
- [] Não deve ser possível cadastrar uma mercadoria com o valor ve custo menor do que o de venda
- [] Não deve ser possível cadastrar uma mercadoria com valor negativo
- [] Não deve ser possível cadastrar uma interação com atendimento inexistente


- [] Todo registro de pagamento a prazo, gera uma ou mais transações de entradas
- [] Um atendimento não pode ser excluido
- [] a Data de uma interação não pode ser menos do que a abertura de um atendimento
- [] Não deve ser possivel 
- [] Não deve ser possível cadastrar um cliente com o mesmo cpf, cnpj
- [] Todo registro de pagamento gera uma transação de entrada, 
se a condição de pagamento é a prazo ela por definição é não paga





## RNFs (Requisitos não-funcionais)
