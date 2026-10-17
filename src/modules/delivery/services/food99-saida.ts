// Partes puras do "saiu para entrega" da 99 (sem importar o env: o controlador do despacho e os testes usam sem subir a
// configuração do servidor).

/**
 * Saída do motoboy da própria loja (17/10/2026, Katatau: o pedido ficava "Pronto" na 99 depois do despacho, porque só mandávamos o
 * "pronto"). A 99 tem uma chamada própria para "saiu para entrega" na entrega da loja: Logistics API › Order Dispatched,
 * POST /v1/order/selfdelivery/dispatch (lido na documentação oficial em 17/10/2026; cópia em _claude-sync/dados/doc99-2026-10-17).
 * Obrigatórios: nome, primeiro nome, sobrenome, código do país e telefone do entregador, e os horários (Unix, 10 dígitos).
 * Decisão do Thomás (17/10/2026): vai o nome do motoboy e o telefone da LOJA (o cliente liga para a loja, não para o motoboy).
 */
export interface SaidaDaEntrega99 {
  /** Nome do motoboy como o PDV mandou; vazio = "Entregador da loja". */
  nomeDoEntregador?: string | null
  /** Telefone com DDD, só dígitos e sem o 55 (ver telefoneDaLojaPara99). */
  telefone: string
  saidaEm: Date
  chegadaPrevista: Date
}

/** Corpo do "saiu para entrega" (sem o auth_token e o order_id, que o orderCall põe). */
export function corpoDaSaida99(s: SaidaDaEntrega99): Record<string, unknown> {
  const nome = (s.nomeDoEntregador || '').trim().replace(/\s+/g, ' ') || 'Entregador da loja'
  const [primeiro, ...resto] = nome.split(' ')
  return {
    courier_info: {
      courier_name: nome,
      courier_first_name: primeiro,
      courier_last_name: resto.join(' ') || 'Entregador',
      courier_phone_code: '+55',
      courier_phone: s.telefone,
    },
    vehicle: { vehicle_type: 102 }, // 102 = moto
    limit_time: {
      pickup_time: Math.floor(s.saidaEm.getTime() / 1000),
      delivery_time: Math.floor(s.chegadaPrevista.getTime() / 1000),
    },
  }
}

/** Telefone da loja no formato da 99: só dígitos, com DDD e sem o 55 do país. Menos de 10 dígitos = sem telefone. */
export function telefoneDaLojaPara99(numero?: string | null): string | null {
  let d = (numero || '').replace(/\D/g, '')
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2)
  if (d.startsWith('0')) d = d.replace(/^0+/, '')
  return d.length >= 10 && d.length <= 11 ? d : null
}
