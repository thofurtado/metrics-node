/**
 * Fase 4 do Mergulho (01:R11): o Ponto manda o PIN no endereço (/hr/time-clock/status?pin=1234) e o registro de pedidos do
 * servidor guardava o PIN inteiro. Troca o valor do PIN por **** antes de registrar.
 */
export function tirarPinDoEndereco(url: string): string {
    return url.replace(/([?&]pin=)[^&#]*/gi, '$1****')
}
