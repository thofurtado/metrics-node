import { acharSetorPeloNome } from './plataformas'

interface SetorSimples {
    id: string
    name: string
}

interface BancoDosSetores {
    sector: {
        findMany(args: { select: { id: true; name: true } }): Promise<SetorSimples[]>
        create(args: { data: { name: string; type: string }; select: { id: true; name: true } }): Promise<SetorSimples>
    }
}

/**
 * Setores por nome, criando o que faltar (15/10/2026): "Taxas de plataforma" (comissões do iFood/99) e "Motoboy" (acerto do
 * motoboy) nascem sozinhos na primeira vez que são usados, como o Thomás decidiu (plano, item 1.8). O nome é comparado sem
 * acento nem maiúscula, para não criar "motoboy" ao lado de "Motoboy". Uma lista por conferência/lote (a mesma busca não
 * repete).
 */
export function setoresPorNome(db: BancoDosSetores) {
    let setores: SetorSimples[] | null = null
    return async function garantirSetor(nome: string, tipo: 'in' | 'out' = 'out'): Promise<string> {
        if (!setores) setores = await db.sector.findMany({ select: { id: true, name: true } })
        const achado = acharSetorPeloNome(setores, nome)
        if (achado) return achado.id
        const novo = await db.sector.create({ data: { name: nome, type: tipo }, select: { id: true, name: true } })
        setores.push(novo)
        return novo.id
    }
}
