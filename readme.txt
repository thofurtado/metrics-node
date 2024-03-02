# Metrics

## RFs (Requisitos funcionais)


## minimo
- [x] Deve ser possível cadastrar um usuário;
- [x] Deve ser possível se autenticar;
- [x] Deve ser possível cadastrar uma conta
- [] Deve ser possível cadastrar um setor
- [x] Deve ser possível criar uma transação
- [] Deve ser possível criar uma transação de transferência
- [] Deve ser possível criar uma forma de pagamento

## meio caminho

- [x] Deve ser possível obter o perfil de um usuário logado;
- [ ] Deve ser possivel iniciar um atendimento
- [ ] Deve ser possível interagir com um atendimento
- [ ] Deve ser possível editar um atendimento
- [ ] Deve ser possível editar uma interação de atendimento
- [ ] Deve ser possível adicionar produtos a um atendimento
- [ ] Deve ser possível remover produtos de um atendimento
- [ ] Deve ser possível cadastrar produtos
- [ ] Deve ser possível consultar produtos
- [ ] Deve ser possível editar produtos
- [ ] Deve ser possível deletar produtos
- [ ] Deve ser possível cadastrar 
- [ ] Deve ser possível cadastrar equipamentos
- [ ] Deve ser possível vincular um equipamento a um atendimento
- [ ] Deve ser possível cadastrar uma transação financeira
- [ ] Deve ser possível editar uma transação financeira
- [x] Deve ser possível criar uma conta


## RNs (Regras de Negócio)

## minimo

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


## meio caminho


- [] Todo registro de pagamento a prazo, gera uma ou mais transações de entradas
- [] Um atendimento não pode ser excluido
- [] a Data de uma interação não pode ser menos do que a abertura de um atendimento
- [] Não deve ser possivel 
- [] Não deve ser possível cadastrar um cliente com o mesmo cpf, cnpj
- [] Todo registro de pagamento gera uma transação de entrada, 
se a condição de pagamento é a prazo ela por definição é não paga





## RNFs (Requisitos não-funcionais)