/**
 * Telefone do cliente — Fase 4 do Mergulho (16:A8, 15/10/2026).
 *
 * A coluna clients.phone não é única (e a Katatau já tem telefones repetidos, então um índice único precisa de migração
 * e limpeza antes). Enquanto isso, o cadastro e a edição pela web avisam quando já existe outro cliente com o mesmo
 * telefone: antes o mesmo cliente virava dois cadastros e o histórico (O.S., equipamentos, conta a prazo) se dividia.
 * A comparação é pelos dígitos (com ou sem máscara, com ou sem o 55 do país). A sincronia do PDV não passa por aqui.
 */

export function digitosDoTelefone(fone: string | null | undefined): string {
    let d = (fone ?? '').replace(/\D/g, '')
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
    return d.replace(/^0+/, '')
}

/** Telefone que identifica alguém: pelo menos 8 dígitos e não só zeros ("00000000000" é o "sem telefone" do PDV antigo). */
export function telefoneDeVerdade(fone: string | null | undefined): boolean {
    return digitosDoTelefone(fone).length >= 8
}

export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!telefoneDeVerdade(a) || !telefoneDeVerdade(b)) return false
    return digitosDoTelefone(a) === digitosDoTelefone(b)
}

interface ClientesComTelefone {
    client: {
        findMany(args: {
            where: { phone: { contains: string }; id?: { not: string } }
            select: { id: true; name: true; phone: true }
            take: number
        }): Promise<{ id: string; name: string; phone: string | null }[]>
    }
}

/** Outro cliente com o mesmo telefone (busca pelos 4 últimos dígitos, que ficam juntos em qualquer máscara). */
export async function acharClienteComTelefone(
    db: ClientesComTelefone,
    fone: string | null | undefined,
    excetoId?: string,
): Promise<{ id: string; name: string } | null> {
    if (!telefoneDeVerdade(fone)) return null
    const final = digitosDoTelefone(fone).slice(-4)
    const candidatos = await db.client.findMany({
        where: { phone: { contains: final }, ...(excetoId ? { id: { not: excetoId } } : {}) },
        select: { id: true, name: true, phone: true },
        take: 200,
    })
    const achado = candidatos.find(c => mesmoTelefone(c.phone, fone))
    return achado ? { id: achado.id, name: achado.name } : null
}
