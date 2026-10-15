import { describe, expect, it, vi } from 'vitest'
import { produtoUnicoPeloNome } from './produto-por-nome'

function bancoCom(produtos: { id: string; name: string; active?: boolean | null }[]) {
  const findMany = vi.fn(async ({ where }: any) =>
    produtos.filter((p) => p.name.toLowerCase() === String(where.name.equals).toLowerCase()),
  )
  return { prisma: { product: { findMany } }, findMany }
}

describe('vínculo do item do iFood/99 pelo nome (Mergulho 09:F4)', () => {
  it('um só produto com o nome (sem diferenciar maiúsculas): liga', async () => {
    const { prisma } = bancoCom([{ id: 'p1', name: 'X-Burguer' }])
    expect((await produtoUnicoPeloNome(prisma, 'x-burguer'))?.id).toBe('p1')
  })

  it('dois produtos ativos com o mesmo nome: NÃO liga (antes pegava o primeiro)', async () => {
    const { prisma } = bancoCom([{ id: 'p1', name: 'Escova de dente' }, { id: 'p2', name: 'Escova de Dente' }])
    expect(await produtoUnicoPeloNome(prisma, 'Escova de dente')).toBeNull()
  })

  it('um ativo e um desativado com o mesmo nome: liga o ativo', async () => {
    const { prisma } = bancoCom([{ id: 'velho', name: 'Pizza', active: false }, { id: 'novo', name: 'Pizza', active: true }])
    expect((await produtoUnicoPeloNome(prisma, 'Pizza'))?.id).toBe('novo')
  })

  it('só um desativado: liga (como antes); nome vazio não procura', async () => {
    const { prisma, findMany } = bancoCom([{ id: 'velho', name: 'Pizza', active: false }])
    expect((await produtoUnicoPeloNome(prisma, ' Pizza '))?.id).toBe('velho')
    expect(await produtoUnicoPeloNome(prisma, '   ')).toBeNull()
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
