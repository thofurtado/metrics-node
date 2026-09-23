export const LATEST_SCHEMA_VERSION = 'v2.4.0'

export const LATEST_SCHEMA_CHANGES = [
  '• Grupos de Adicionais & Complementos: ComplementGroup, ComplementOption e vínculo N:N ProductComplementGroup com regras de mín/máx e quantidade gratuita (estilo iFood)',
  '• Subcategorias de Produtos: Subcategory com regras de fracionamento de meia pizza (accepts_fractions, max_fractions)',
  '• KDS Prioridade: Campo is_priority no modelo Product para ordenação prioritária na cozinha',
  '• Fechamento às Cegas (Caixa): Campo blind_cashier_closure e cashier_default_origin em SystemConfig',
  '• Financeiro - Multa Independente: Campo fine (Multa R$) separado de Juros (interest) em Transaction',
  '• Vínculo de item de Delivery: Pedido.plataforma, PedidoItem.external_code/external_name e o novo modelo DeliveryItemMapping (código do item do iFood/99Food ↔ produto do Metrics)',
]
