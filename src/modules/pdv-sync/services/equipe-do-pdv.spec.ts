import { describe, it, expect } from 'vitest'
import { compare, hash } from 'bcryptjs'
import {
    chaveDoGrupo,
    emailDoFuncionario,
    funcionarioEntraNoPdv,
    funcionarioParaConsumo,
    funcionarioParaPdv,
    funcionarioSoParaConsumo,
    normalizarNomeDoGrupo,
    usuarioParaPdv,
    type FuncionarioComGrupo,
} from './equipe-do-pdv'

const criadoEm = new Date('2026-10-01T12:00:00Z')

function funcionario(parcial: Partial<FuncionarioComGrupo> = {}): FuncionarioComGrupo {
    return {
        id: '6b1f3c2e-0000-4000-8000-000000000001',
        name: 'Ana',
        pin: '4821',
        isRegistered: true,
        user_id: null,
        created_at: criadoEm,
        group: { name: 'Garçom', can_use_waiter_app: true, can_use_pdv: false },
        ...parcial,
    }
}

const proteger = (texto: string) => hash(texto, 4)

describe('equipe que entra no PDV e no app do garçom', () => {
    it('usuário do sistema vai como antes e, com PIN, também entra no celular', () => {
        const comPin = usuarioParaPdv({ id: 'u1', name: 'Gerente', email: 'g@loja.com', password_hash: '$2a$x', pin_hash: '$2a$y', role: 'ADMIN', created_at: criadoEm })
        expect(comPin).toMatchObject({ Uuid: 'u1', Role: 'ADMIN', Active: true, Origem: 'USUARIO', PodePdv: true, PodeAppGarcom: true })
        const semPin = usuarioParaPdv({ id: 'u2', name: 'Contador', email: 'c@loja.com', password_hash: '$2a$x', pin_hash: null, role: 'TECHNICIAN', created_at: criadoEm })
        expect(semPin.PodeAppGarcom).toBe(false)
    })

    it('só entra quem está ativo, tem grupo com acesso, PIN no padrão e não é um usuário', () => {
        expect(funcionarioEntraNoPdv(funcionario())).toBe(true)
        expect(funcionarioEntraNoPdv(funcionario({ isRegistered: false }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ group: null }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ group: { name: 'Cozinha', can_use_waiter_app: false, can_use_pdv: false } }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ user_id: 'u1' }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ pin: '12' }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ pin: 'abcd' }))).toBe(false)
        expect(funcionarioEntraNoPdv(funcionario({ pin: ' 4821 ' }))).toBe(true)
        expect(funcionarioEntraNoPdv(funcionario({ group: { name: 'Caixa', can_use_waiter_app: false, can_use_pdv: true } }))).toBe(true)
    })

    it('o PIN do ponto vai protegido (nunca em texto aberto) e confere com o PIN digitado', async () => {
        const p = await funcionarioParaPdv(funcionario(), proteger, () => 'segredo-aleatorio')
        expect(p.PinHash).not.toContain('4821')
        expect(p.PinHash!.startsWith('$2')).toBe(true)
        expect(await compare('4821', p.PinHash!)).toBe(true)
        expect(await compare('1111', p.PinHash!)).toBe(false)
    })

    it('a senha do funcionário é impossível de acertar e o e-mail é só uma marcação única', async () => {
        const p = await funcionarioParaPdv(funcionario(), proteger, () => 'segredo-que-ninguem-sabe')
        expect(await compare('', p.PasswordHash)).toBe(false)
        expect(await compare('4821', p.PasswordHash)).toBe(false)
        expect(p.Email).toBe(emailDoFuncionario('6b1f3c2e-0000-4000-8000-000000000001'))
    })

    it('o grupo decide o papel: PDV = caixa; só o app = garçom; nunca administrador', async () => {
        const garcom = await funcionarioParaPdv(funcionario(), proteger, () => 's')
        expect(garcom).toMatchObject({ Role: 'MEMBER', Origem: 'FUNCIONARIO', Grupo: 'Garçom', PodePdv: false, PodeAppGarcom: true })
        const caixa = await funcionarioParaPdv(funcionario({ group: { name: 'Caixa', can_use_waiter_app: true, can_use_pdv: true } }), proteger, () => 's')
        expect(caixa).toMatchObject({ Role: 'CASHIER', PodePdv: true, PodeAppGarcom: true })
    })

    it('consumo e vale (10/10/2026): todo funcionário ativo vai, quem não entra em nada vai sem PIN e sem acesso', async () => {
        // Katatau: os 9 funcionários estão num grupo sem acesso; antes nenhum chegava ao PDV
        const balconista = funcionario({ group: { name: 'Balconista', can_use_waiter_app: false, can_use_pdv: false } })
        expect(funcionarioEntraNoPdv(balconista)).toBe(false)
        expect(funcionarioSoParaConsumo(balconista)).toBe(true)
        const p = await funcionarioParaConsumo(balconista, proteger, () => 'segredo')
        expect(p).toMatchObject({ Uuid: balconista.id, Origem: 'FUNCIONARIO', Grupo: 'Balconista', PinHash: null, PodePdv: false, PodeAppGarcom: false, Role: 'MEMBER', FuncionarioRh: true })
        expect(await compare('', p.PasswordHash)).toBe(false)

        // Sem grupo ou com PIN fora do padrão também vai (só para o consumo)
        expect(funcionarioSoParaConsumo(funcionario({ group: null }))).toBe(true)
        expect(funcionarioSoParaConsumo(funcionario({ pin: '12' }))).toBe(true)
        // Quem entra no PDV vai pelo caminho de sempre; inativo e ligado a usuário não vão
        expect(funcionarioSoParaConsumo(funcionario())).toBe(false)
        expect(funcionarioSoParaConsumo(funcionario({ isRegistered: false }))).toBe(false)
        expect(funcionarioSoParaConsumo(funcionario({ user_id: 'u1' }))).toBe(false)
        expect((await funcionarioParaPdv(funcionario(), proteger, () => 's')).FuncionarioRh).toBe(true)
    })

    it('usuário do sistema ligado a um funcionário vai marcado para o consumo; os outros, não', () => {
        const u = { id: 'u1', name: 'Gerente', email: 'g@loja.com', password_hash: '$2a$x', pin_hash: null, role: 'ADMIN', created_at: criadoEm }
        expect(usuarioParaPdv(u).FuncionarioRh).toBe(false)
        expect(usuarioParaPdv(u, true).FuncionarioRh).toBe(true)
    })

    it('nome do grupo sem espaços sobrando', () => {
        expect(normalizarNomeDoGrupo('  Garçom   de  salão ')).toBe('Garçom de salão')
        expect(normalizarNomeDoGrupo(null)).toBe('')
    })

    it('mesmo grupo sem olhar acento nem maiúscula (cargos reais do Marujo: "maitrê", "MAITRE ")', () => {
        expect(chaveDoGrupo('maitrê')).toBe(chaveDoGrupo('MAITRE '))
        expect(chaveDoGrupo('Garçom')).toBe('garcom')
        expect(chaveDoGrupo('  Atendente   de  Salão ')).toBe('atendente de salao')
        expect(chaveDoGrupo('Garçom')).not.toBe(chaveDoGrupo('Garçonete'))
    })
})
