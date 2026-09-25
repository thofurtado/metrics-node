// Regras do "Sincronizar" do SaaS Admin: o banco de um cliente nunca perde tabela, coluna ou dado.
//
// Depois das migrations, o Prisma gera o SQL que deixaria o banco igual ao schema (prisma migrate diff --script).
// Esse SQL mistura o que falta (tabela, coluna, índice, ligação, valor de enum) com o que "sobra" no banco
// (DROP TABLE, DROP COLUMN...). Aqui separamos: o que só acrescenta é aplicado; o que apagaria ou alteraria
// algo existente é mantido como está e apenas listado para alguém decidir. Na dúvida, não aplica.

export type Passo = { sql: string; descricao: string }
export type DiffSeparado = { aplicar: Passo[]; mantidos: string[] }

const nome = (s: string) => s.replace(/"public"\./g, '').replace(/"/g, '')

function semComentarios(script: string) {
  return script
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')
}

function comandos(script: string): string[] {
  return semComentarios(script)
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(Boolean)
}

// Uma cláusula de "ALTER TABLE <tabela> ...". O Prisma junta várias na mesma frase, uma por linha.
function clausula(tabela: string, texto: string): { passo?: Passo; mantido?: string } {
  const t = nome(tabela)
  let m: RegExpMatchArray | null
  if ((m = texto.match(/^ADD COLUMN\s+("[^"]+"|\S+)/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `coluna ${t}.${nome(m[1])}` } }
  if ((m = texto.match(/^ADD CONSTRAINT\s+("[^"]+"|\S+)\s+FOREIGN KEY/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `ligação ${nome(m[1])}` } }
  if ((m = texto.match(/^ADD CONSTRAINT\s+("[^"]+"|\S+)/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `restrição ${nome(m[1])}` } }
  if ((m = texto.match(/^ALTER COLUMN\s+("[^"]+"|\S+)\s+DROP NOT NULL$/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `${t}.${nome(m[1])} passa a aceitar vazio` } }
  if ((m = texto.match(/^ALTER COLUMN\s+("[^"]+"|\S+)\s+SET NOT NULL$/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `${t}.${nome(m[1])} passa a ser obrigatória` } }
  if ((m = texto.match(/^ALTER COLUMN\s+("[^"]+"|\S+)\s+SET DEFAULT\s/i))) return { passo: { sql: `ALTER TABLE ${tabela} ${texto}`, descricao: `valor padrão de ${t}.${nome(m[1])}` } }

  if ((m = texto.match(/^DROP COLUMN\s+("[^"]+"|\S+)/i))) return { mantido: `coluna ${t}.${nome(m[1])} (não existe no sistema)` }
  if ((m = texto.match(/^DROP CONSTRAINT\s+("[^"]+"|\S+)/i))) return { mantido: `restrição ou ligação ${nome(m[1])} da tabela ${t} (não existe no sistema)` }
  if ((m = texto.match(/^ALTER COLUMN\s+("[^"]+"|\S+)\s+(SET DATA\s+)?TYPE\s/i))) return { mantido: `coluna ${t}.${nome(m[1])} com tipo diferente do sistema (não alterada)` }
  if ((m = texto.match(/^ALTER COLUMN\s+("[^"]+"|\S+)\s+DROP DEFAULT$/i))) return { mantido: `valor padrão de ${t}.${nome(m[1])} (o sistema não usa)` }
  return { mantido: `comando não reconhecido, não aplicado: ALTER TABLE ${t} ${texto.slice(0, 150)}` }
}

function comando(sql: string): { passos: Passo[]; mantidos: string[] } {
  let m: RegExpMatchArray | null
  const aplica = (descricao: string) => ({ passos: [{ sql, descricao }], mantidos: [] })
  const mantem = (descricao: string) => ({ passos: [], mantidos: [descricao] })

  if ((m = sql.match(/^CREATE TABLE\s+(\S+)/i))) return aplica(`tabela ${nome(m[1])}`)
  if ((m = sql.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+("[^"]+"|\S+)/i))) return aplica(`índice ${nome(m[2])}`)
  if ((m = sql.match(/^CREATE TYPE\s+(\S+)/i))) return aplica(`tipo ${nome(m[1])}`)
  if (/^CREATE SCHEMA IF NOT EXISTS\s/i.test(sql)) return aplica('esquema do banco')
  if ((m = sql.match(/^CREATE EXTENSION IF NOT EXISTS\s+(\S+)/i))) return aplica(`extensão ${nome(m[1])}`)
  if ((m = sql.match(/^ALTER TYPE\s+(\S+)\s+ADD VALUE\s+'([^']+)'/i))) return aplica(`valor ${m[2]} do tipo ${nome(m[1])}`)
  if ((m = sql.match(/^ALTER INDEX\s+(\S+)\s+RENAME TO\s+(\S+)$/i))) return aplica(`índice ${nome(m[1])} renomeado para ${nome(m[2])}`)

  if ((m = sql.match(/^ALTER TABLE\s+((?:"[^"]+"\.)?"[^"]+"|\S+)\s+([\s\S]+)$/i))) {
    const tabela = m[1]
    const partes = m[2].split(/,[ \t]*\r?\n/).map(p => p.trim()).filter(Boolean)
    const passos: Passo[] = []
    const mantidos: string[] = []
    for (const p of partes) {
      const r = clausula(tabela, p)
      if (r.passo) passos.push(r.passo)
      if (r.mantido) mantidos.push(r.mantido)
    }
    return { passos, mantidos }
  }

  if ((m = sql.match(/^DROP TABLE\s+(\S+)/i))) return mantem(`tabela ${nome(m[1])} (não existe no sistema)`)
  if ((m = sql.match(/^DROP INDEX\s+(\S+)/i))) return mantem(`índice ${nome(m[1])} (não existe no sistema)`)
  if ((m = sql.match(/^DROP TYPE\s+(\S+)/i))) return mantem(`tipo ${nome(m[1])} (não existe no sistema)`)
  return mantem(`comando não reconhecido, não aplicado: ${sql.slice(0, 150)}`)
}

export function separarDiff(script: string): DiffSeparado {
  const aplicar: Passo[] = []
  const mantidos: string[] = []
  const lista = comandos(script)

  for (let i = 0; i < lista.length; i++) {
    // Bloco BEGIN...COMMIT (o Prisma usa para refazer um enum): tudo ou nada.
    if (/^BEGIN$/i.test(lista[i])) {
      const bloco: string[] = []
      for (i++; i < lista.length && !/^COMMIT$/i.test(lista[i]); i++) bloco.push(lista[i])
      const partes = bloco.map(comando)
      if (partes.every(p => p.mantidos.length === 0)) {
        aplicar.push({ sql: `BEGIN;\n${bloco.join(';\n')};\nCOMMIT;`, descricao: partes.flatMap(p => p.passos.map(x => x.descricao)).join('; ') })
      } else {
        const tipo = bloco.join('\n').match(/CREATE TYPE\s+"?([^"\s]+?)_new"?\s/i)
        mantidos.push(tipo ? `tipo ${tipo[1]} com valores diferentes do sistema (não alterado)` : `bloco não aplicado: ${bloco.join('; ').slice(0, 150)}`)
      }
      continue
    }
    const r = comando(lista[i])
    aplicar.push(...r.passos)
    mantidos.push(...r.mantidos)
  }
  return { aplicar, mantidos }
}

// Mensagem do Prisma/Postgres pronta para mostrar no Admin: sem ruído e nunca com o endereço do banco.
export function limparMensagem(texto: unknown): string {
  return String(texto ?? '')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '<banco>')
    .split('\n')
    .filter(l => !/^(warn The configuration property|For more information, see: https:\/\/pris\.ly\/prisma-config|Environment variables loaded|Prisma schema loaded from|Datasource "db")/.test(l.trim()))
    .join('\n')
    .trim()
    .slice(0, 2000)
}
