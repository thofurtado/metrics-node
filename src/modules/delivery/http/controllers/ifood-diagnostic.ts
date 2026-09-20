import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getPrismaForDb } from '@/lib/tenant-manager'
import { requestContext } from '@fastify/request-context'
import { ifoodApi } from '../../services/ifood-api.service'
import { getValidAccessToken } from '../../services/ifood-poller'
import { writeJournal } from '../../services/ifood-events.service'

/**
 * Acompanhamento do cenário de cancelamento do iFood (homologação e testes).
 *
 *   GET  /delivery/ifood/diag?key=...[&orderId=...]           página que se atualiza sozinha
 *   GET  /delivery/ifood/diag/data?key=...[&orderId=...]      os mesmos dados em JSON
 *   POST /delivery/ifood/diag/cancel-probe?key=...&orderId=...&confirm=SIM[&code=...]   cancela um pedido de TESTE agora
 *
 * Só funciona se a variável de ambiente IFOOD_DIAG_KEY estiver definida (e a chave for enviada em ?key=).
 * Nada aqui confia na documentação: mostra o que realmente foi enviado, recebido e confirmado, com tempos.
 */

function auditDbName() {
  return process.env.IFOOD_AUDIT_DB || 'db_restaurante'
}

function guard(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = process.env.IFOOD_DIAG_KEY
  if (!expected) {
    reply.status(404).send({ message: 'Diagnóstico desativado (defina IFOOD_DIAG_KEY).' })
    return false
  }
  const key = (request.query as any)?.key
  if (key !== expected) {
    reply.status(403).send({ message: 'Chave inválida.' })
    return false
  }
  return true
}

interface TimelineEntry {
  at: string
  kind: 'EVENT' | 'PDV' | 'CALL' | 'ACK'
  title: string
  detail: string
  ok: boolean | null
  raw?: unknown
}

interface Check {
  label: string
  ok: boolean | null // null = ainda não aconteceu
  detail: string
}

const short = (v: unknown, n = 700) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function describeLog(log: any): TimelineEntry {
  const at = new Date(log.created_at).toISOString()
  const endpoint = String(log.endpoint || '')
  const status = log.response_status
  const resp: any = log.response_body || {}

  if (log.method === 'EVENT') {
    const req: any = log.request_body || {}
    const code = req.code || req.fullCode || '?'
    const parts = [`canal ${resp.source ?? '?'}`]
    if (resp.latencyMs != null) parts.push(`chegou ${(resp.latencyMs / 1000).toFixed(1)}s após ser criado`)
    if (resp.ackMs != null) parts.push(`confirmado em ${resp.ackMs}ms`)
    if (resp.duplicate) parts.push('DUPLICADO')
    if (resp.outcome) parts.push(`→ ${resp.outcome}`)
    return {
      at,
      kind: 'EVENT',
      title: `Evento ${code}${req.fullCode && req.fullCode !== code ? ` (${req.fullCode})` : ''}`,
      detail: parts.join(' · '),
      ok: log.success,
      raw: req,
    }
  }

  if (log.method === 'PDV') {
    return { at, kind: 'PDV', title: `PDV: ${endpoint.replace('/pdv/', '')}`, detail: short(log.response_body ?? log.request_body), ok: log.success, raw: log.response_body ?? log.request_body }
  }

  if (endpoint.includes('acknowledgment')) {
    const ids = Array.isArray(log.request_body) ? log.request_body.length : '?'
    return { at, kind: 'ACK', title: 'ACK enviado ao iFood', detail: `${ids} evento(s) · status ${status} · ${log.duration_ms}ms`, ok: log.success }
  }

  let title = `${log.method} ${endpoint}`
  if (endpoint.includes('cancellationReasons')) title = 'Consulta dos motivos de cancelamento'
  else if (endpoint.includes('requestCancellation')) title = 'Solicitação de cancelamento'
  else if (endpoint.includes('/confirm')) title = 'Confirmar pedido'
  else if (endpoint.includes('/dispatch')) title = 'Despachar pedido'
  else if (endpoint.includes('readyToPickup')) title = 'Pronto para retirada'
  const detailParts = [`status ${status ?? '—'}`, `${log.duration_ms}ms`]
  if (log.request_body) detailParts.push(`enviado: ${short(log.request_body, 300)}`)
  if (log.response_body) detailParts.push(`resposta: ${short(log.response_body, 500)}`)
  if (log.error_message) detailParts.push(`erro: ${log.error_message}`)
  return { at, kind: 'CALL', title, detail: detailParts.join(' · '), ok: log.success, raw: log.response_body }
}

async function buildTimeline(orderId: string) {
  const prisma: any = await getPrismaForDb(auditDbName())
  const orderLogs: any[] = await prisma.ifoodApiLog.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: 'asc' },
    take: 300,
  })

  // ACKs não têm order_id: entram os que confirmam eventos deste pedido.
  const eventIds = new Set<string>(
    orderLogs.filter((l) => l.method === 'EVENT' && l.request_body?.id).map((l) => String(l.request_body.id)),
  )
  let ackLogs: any[] = []
  if (orderLogs.length > 0) {
    const from = new Date(new Date(orderLogs[0].created_at).getTime() - 5 * 60 * 1000)
    const acks: any[] = await prisma.ifoodApiLog.findMany({
      where: { endpoint: { contains: 'acknowledgment' }, created_at: { gte: from } },
      orderBy: { created_at: 'asc' },
      take: 200,
    })
    ackLogs = acks.filter((a) => Array.isArray(a.request_body) && a.request_body.some((x: any) => eventIds.has(String(x?.id))))
  }

  const logs = [...orderLogs, ...ackLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const entries = logs.map(describeLog)

  // ------------------------------------------------------------ checklist do cenário de cancelamento
  const find = (pred: (l: any) => boolean) => logs.find(pred)
  const events = logs.filter((l) => l.method === 'EVENT')
  const codeOf = (l: any) => String(l.request_body?.code || l.request_body?.fullCode || '')
  const t = (l: any) => new Date(l.created_at).getTime()

  const plc = events.find((l) => codeOf(l) === 'PLC')
  const reasonsCall = find((l) => String(l.endpoint).includes('cancellationReasons'))
  const reasonsShown = find((l) => l.method === 'PDV' && String(l.endpoint).includes('motivos-exibidos'))
  const cancelCall = find((l) => String(l.endpoint).includes('requestCancellation'))
  const car = events.find((l) => ['CAR'].includes(codeOf(l)) || String(l.request_body?.fullCode) === 'CANCELLATION_REQUESTED')
  const carf = events.find((l) => codeOf(l) === 'CARF' || String(l.request_body?.fullCode) === 'CANCELLATION_REQUEST_FAILED')
  const can = events.find((l) => codeOf(l) === 'CAN' || String(l.request_body?.fullCode) === 'CANCELLED')

  const reasonsBody: any = reasonsCall?.response_body
  const reasonsCount = Array.isArray(reasonsBody) ? reasonsBody.length : Array.isArray(reasonsBody?.reasons) ? reasonsBody.reasons.length : null

  const ackMsList = events.map((l) => Number((l.response_body as any)?.ackMs)).filter((n) => Number.isFinite(n) && n > 0)
  const slowestAck = ackMsList.length ? Math.max(...ackMsList) : null
  const dupCount = events.filter((l) => (l.response_body as any)?.duplicate).length

  // pedido local
  let localStatus: string | null = null
  try {
    const localPrisma: any = await getPrismaForDb(auditDbName())
    const pedido = await localPrisma.pedido.findFirst({
      where: { observacao: { contains: `[iFood:${orderId}]` } },
      select: { display_id: true, status: true, status_delivery: true },
    })
    localStatus = pedido ? `#${pedido.display_id}: ${pedido.status}/${pedido.status_delivery}` : null
  } catch (_) {}

  const checks: Check[] = [
    { label: 'Pedido chegou (evento PLC)', ok: plc ? true : null, detail: plc ? `via ${(plc.response_body as any)?.source}` : 'ainda não' },
    {
      label: 'Motivos consultados no iFood (antes de cancelar)',
      ok: reasonsCall ? reasonsCall.response_status === 200 : null,
      detail: reasonsCall ? `status ${reasonsCall.response_status}${reasonsCount != null ? `, ${reasonsCount} motivo(s)` : ''}` : 'ainda não',
    },
    { label: 'Lista de motivos mostrada ao operador no PDV', ok: reasonsShown ? true : null, detail: reasonsShown ? short(reasonsShown.response_body, 200) : 'ainda não' },
    {
      label: 'Cancelamento solicitado (POST requestCancellation)',
      ok: cancelCall ? cancelCall.response_status != null && cancelCall.response_status < 300 : null,
      detail: cancelCall ? `status ${cancelCall.response_status}; enviado ${short(cancelCall.request_body, 200)}` : 'ainda não',
    },
    { label: 'Evento CAR (solicitação registrada) recebido', ok: car ? true : null, detail: car ? `via ${(car.response_body as any)?.source}` : 'não chegou' },
    { label: 'Evento CARF (iFood RECUSOU) — deve NÃO aparecer', ok: carf ? false : true, detail: carf ? short(carf.request_body?.metadata, 200) : 'não chegou' },
    {
      label: 'Evento CAN/CANCELLED recebido',
      ok: can ? true : null,
      detail: can ? `via ${(can.response_body as any)?.source}${cancelCall ? `, ${Math.round((t(can) - t(cancelCall)) / 1000)}s após a solicitação` : ''}` : 'não chegou',
    },
    {
      label: 'Confirmação (ACK) dos eventos dentro do prazo',
      ok: slowestAck == null ? null : slowestAck < 3000,
      detail: slowestAck == null ? 'sem medição' : `maior tempo ${slowestAck}ms (polling: limite 10s; webhook: 3s)`,
    },
    { label: 'Eventos duplicados descartados', ok: true, detail: `${dupCount} descartado(s)` },
    { label: 'Pedido cancelado no sistema (banco local)', ok: localStatus ? localStatus.includes('Cancelado') : null, detail: localStatus ?? 'pedido não encontrado' },
  ]

  return { orderId, entries, checks }
}

async function recentOrders() {
  const prisma: any = await getPrismaForDb(auditDbName())
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const logs: any[] = await prisma.ifoodApiLog.findMany({
    where: { order_id: { not: null }, created_at: { gte: since } },
    orderBy: { created_at: 'desc' },
    take: 400,
    select: { order_id: true, created_at: true },
  })
  const seen = new Map<string, Date>()
  for (const l of logs) if (!seen.has(l.order_id)) seen.set(l.order_id, l.created_at)
  return Array.from(seen.entries())
    .slice(0, 15)
    .map(([orderId, at]) => ({ orderId, lastAt: new Date(at).toISOString() }))
}

export async function ifoodDiagDataController(request: FastifyRequest, reply: FastifyReply) {
  if (!guard(request, reply)) return
  try {
    const orders = await recentOrders()
    const orderId = String((request.query as any)?.orderId || orders[0]?.orderId || '')
    if (!orderId) return reply.status(200).send({ orders, orderId: null, entries: [], checks: [] })
    const timeline = await buildTimeline(orderId)
    return reply.status(200).send({ orders, ...timeline })
  } catch (err: any) {
    return reply.status(500).send({ message: err?.message || 'erro' })
  }
}

/** Cancela AGORA um pedido de teste, com o primeiro motivo real da lista (ou o código informado). */
export async function ifoodCancelProbeController(request: FastifyRequest, reply: FastifyReply) {
  if (!guard(request, reply)) return
  const query = z
    .object({ orderId: z.string().min(10), confirm: z.string().optional(), code: z.string().optional() })
    .safeParse(request.query)
  if (!query.success) return reply.status(400).send({ message: 'Informe orderId.' })
  if (query.data.confirm !== 'SIM') {
    return reply.status(400).send({ message: 'Confirmação ausente: envie confirm=SIM. Isto CANCELA o pedido no iFood.' })
  }

  const tenant = (requestContext.get('tenant') as string | undefined) || auditDbName()
  const token = await getValidAccessToken(tenant)
  if (!token) return reply.status(503).send({ message: 'Sem token do iFood para este restaurante.' })

  await writeJournal({ method: 'PDV', endpoint: '/pdv/sonda-cancelamento', orderId: query.data.orderId, request: { code: query.data.code ?? null }, response: { note: 'cancelamento pela sonda de diagnóstico' } })
  const result = await ifoodApi.cancelOrderFromPdv(token, query.data.orderId, { code: query.data.code })
  return reply.status(result.ok ? 200 : 424).send(result)
}

export async function ifoodDiagPageController(request: FastifyRequest, reply: FastifyReply) {
  if (!guard(request, reply)) return
  const key = encodeURIComponent(String((request.query as any)?.key || ''))
  const orderId = encodeURIComponent(String((request.query as any)?.orderId || ''))
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>iFood — acompanhamento do cancelamento</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
header{padding:16px 20px;background:#0f172a;color:#fff}
h1{margin:0;font-size:20px} main{padding:16px 20px;max-width:1100px;margin:auto}
.card{background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
.row{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #e2e8f0;font-size:15px}
.row:first-child{border-top:0}
.dot{width:14px;height:14px;border-radius:50%;flex:none;margin-top:3px;background:#94a3b8}
.ok{background:#059669}.bad{background:#e11d48}.wait{background:#94a3b8}
small{color:#475569}.t{color:#475569;font-variant-numeric:tabular-nums;flex:none;width:76px}
select,button{font-size:15px;padding:8px 10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff}
button.danger{background:#be123c;color:#fff;border-color:#be123c;cursor:pointer}
.kind{font-size:12px;font-weight:700;padding:2px 6px;border-radius:6px;background:#e2e8f0;flex:none}
.k-EVENT{background:#dbeafe}.k-PDV{background:#ede9fe}.k-CALL{background:#fef3c7}.k-ACK{background:#dcfce7}
pre{white-space:pre-wrap;word-break:break-word;margin:4px 0 0;font-size:12px;color:#334155}
</style></head><body>
<header><h1>iFood — acompanhamento do cancelamento</h1><small style="color:#cbd5e1">Atualiza sozinho a cada 3 segundos. Mostra o que foi enviado, recebido e confirmado.</small></header>
<main>
<div class="card"><label>Pedido: <select id="order"></select></label>
 <button class="danger" id="probe" style="float:right">Cancelar este pedido de TESTE agora (sonda)</button></div>
<div class="card"><h3 style="margin-top:0">Checklist</h3><div id="checks">carregando…</div></div>
<div class="card"><h3 style="margin-top:0">Linha do tempo</h3><div id="timeline">carregando…</div></div>
</main>
<script>
var KEY='${key}', current='${orderId}';
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function cls(ok){return ok===true?'ok':(ok===false?'bad':'wait');}
function fmt(iso){var d=new Date(iso);return d.toLocaleTimeString('pt-BR');}
function load(){
  var url='/delivery/ifood/diag/data?key='+KEY+(current?'&orderId='+encodeURIComponent(current):'');
  fetch(url).then(function(r){return r.json();}).then(function(d){
    var sel=document.getElementById('order');
    var opts='';(d.orders||[]).forEach(function(o){opts+='<option value="'+esc(o.orderId)+'"'+(o.orderId===d.orderId?' selected':'')+'>'+esc(o.orderId)+' ('+fmt(o.lastAt)+')</option>';});
    if(sel.innerHTML!==opts){sel.innerHTML=opts;}
    current=d.orderId||current;
    var c='';(d.checks||[]).forEach(function(k){c+='<div class="row"><span class="dot '+cls(k.ok)+'"></span><div><b>'+esc(k.label)+'</b><br><small>'+esc(k.detail)+'</small></div></div>';});
    document.getElementById('checks').innerHTML=c||'Nenhum registro ainda para este pedido.';
    var t='';(d.entries||[]).forEach(function(e){t+='<div class="row"><span class="t">'+fmt(e.at)+'</span><span class="dot '+cls(e.ok)+'"></span><span class="kind k-'+e.kind+'">'+e.kind+'</span><div><b>'+esc(e.title)+'</b><br><small>'+esc(e.detail)+'</small></div></div>';});
    document.getElementById('timeline').innerHTML=t||'Nenhum registro ainda para este pedido.';
  }).catch(function(e){document.getElementById('checks').textContent='Erro ao carregar: '+e;});
}
document.getElementById('order').addEventListener('change',function(ev){current=ev.target.value;load();});
document.getElementById('probe').addEventListener('click',function(){
  if(!current){alert('Escolha um pedido.');return;}
  if(!confirm('Isto CANCELA o pedido '+current+' no iFood (use só em pedido de TESTE). Continuar?')){return;}
  fetch('/delivery/ifood/diag/cancel-probe?key='+KEY+'&orderId='+encodeURIComponent(current)+'&confirm=SIM',{method:'POST'})
    .then(function(r){return r.json();}).then(function(j){alert(JSON.stringify(j));load();});
});
load();setInterval(load,3000);
</script></body></html>`
  return reply.type('text/html; charset=utf-8').send(html)
}
