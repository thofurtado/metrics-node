export const LATEST_SCHEMA_VERSION = 'v1.4.0'

export const LATEST_SCHEMA_CHANGES = `• Adicionados campos de Razão Social (companyName), CNPJ/CPF (document) e CEP (zipcode) ao CompanyProfile.
• Adicionadas regras de entrega e pedidos: Taxa de Entrega (deliveryFee), Valor Mínimo de Pedido (minOrderValue), Tempo Estimado Mínimo e Máximo (deliveryTimeMin/Max).
• Adicionadas chaves de integração para marketplaces (ifoodMerchantId e anotaAiApiKey).
• Estrutura da grade semanal de Horários de Funcionamento (BusinessHour) com vinculo direto ao perfil da empresa.`
