/**
 * Equipe que entra no PDV e no app do garçom (etapa 1.5, 06/10/2026, decisão B5 do Thomás).
 *
 * Além dos usuários do sistema, entram os funcionários do RH com o PIN do ponto, conforme o GRUPO deles
 * (o cargo virou cadastro: "pode usar o app do garçom" e "pode usar o PDV"). Para o PDV eles vão no mesmo
 * formato dos usuários (a venda e o item lançado guardam quem fez), com:
 * - o PIN protegido (bcrypt, como o dos usuários): o PIN do ponto nunca sai em texto aberto para os aparelhos;
 * - senha impossível de acertar (funcionário entra só pelo PIN);
 * - e-mail de marcação único (o PDV exige e-mail), que ninguém usa para entrar.
 * Funcionário inativo, sem grupo, de grupo sem acesso, ligado a um usuário (entra como o usuário) ou com PIN
 * fora do padrão do ponto fica de fora: no PDV ele deixa de poder entrar.
 */

export interface UsuarioDoSistema {
    id: string
    name: string
    email: string
    password_hash: string
    pin_hash: string | null
    role: string
    created_at: Date
}

export interface GrupoDoFuncionario {
    name: string
    can_use_waiter_app: boolean
    can_use_pdv: boolean
}

export interface FuncionarioComGrupo {
    id: string
    name: string
    pin: string
    isRegistered: boolean
    user_id: string | null
    created_at: Date
    group: GrupoDoFuncionario | null
}

export interface PessoaParaPdv {
    Uuid: string
    Name: string
    Email: string
    PasswordHash: string
    PinHash: string | null
    Role: string
    Active: boolean
    CreatedAt: Date
    /** USUARIO (cadastro de usuários do sistema) ou FUNCIONARIO (RH, pelo grupo). */
    Origem: 'USUARIO' | 'FUNCIONARIO'
    Grupo: string | null
    PodePdv: boolean
    PodeAppGarcom: boolean
}

/** O mesmo padrão do PIN dos usuários (4 a 6 números); o ponto usa 4. */
export const PIN_VALIDO = /^\d{4,6}$/

export function usuarioParaPdv(u: UsuarioDoSistema): PessoaParaPdv {
    return {
        Uuid: u.id,
        Name: u.name,
        Email: u.email,
        PasswordHash: u.password_hash,
        PinHash: u.pin_hash,
        Role: u.role,
        Active: true,
        CreatedAt: u.created_at,
        Origem: 'USUARIO',
        Grupo: null,
        PodePdv: true,
        // Usuário do sistema com PIN também entra no celular (o gerente, por exemplo)
        PodeAppGarcom: !!u.pin_hash,
    }
}

export function funcionarioEntraNoPdv(f: FuncionarioComGrupo): boolean {
    if (!f.isRegistered || f.user_id) return false
    if (!f.group || !(f.group.can_use_pdv || f.group.can_use_waiter_app)) return false
    return PIN_VALIDO.test((f.pin ?? '').trim())
}

/** E-mail de marcação do funcionário no PDV (único; ninguém entra por ele). */
export function emailDoFuncionario(id: string): string {
    return `funcionario-${id}@metrics.local`
}

export async function funcionarioParaPdv(
    f: FuncionarioComGrupo,
    protegerTexto: (texto: string) => Promise<string>,
    segredoAleatorio: () => string,
): Promise<PessoaParaPdv> {
    const grupo = f.group!
    return {
        Uuid: f.id,
        Name: f.name,
        Email: emailDoFuncionario(f.id),
        PasswordHash: await protegerTexto(segredoAleatorio()),
        PinHash: await protegerTexto(f.pin.trim()),
        // Caixa no PDV = operador de caixa; só o app do garçom = garçom (nunca administrador)
        Role: grupo.can_use_pdv ? 'CASHIER' : 'MEMBER',
        Active: true,
        CreatedAt: f.created_at,
        Origem: 'FUNCIONARIO',
        Grupo: grupo.name,
        PodePdv: grupo.can_use_pdv,
        PodeAppGarcom: grupo.can_use_waiter_app,
    }
}

/** Nome do grupo como o cargo era digitado: sem espaços sobrando ("  Garçom  de salão " → "Garçom de salão"). */
export function normalizarNomeDoGrupo(texto: string | null | undefined): string {
    return (texto ?? '').trim().replace(/\s+/g, ' ')
}

/**
 * Chave para comparar nomes de grupo: sem acento, sem diferença de maiúscula e com um espaço só ("Maitrê" = "maitre",
 * "GARÇOM" = "garcom"). Igual à da migração 20261006120000_grupos_de_funcionarios (06/10/2026: no Marujo havia "maitrê" e
 * "garçon", que viravam grupos sem acesso ao app).
 */
export function chaveDoGrupo(texto: string | null | undefined): string {
    return normalizarNomeDoGrupo(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
