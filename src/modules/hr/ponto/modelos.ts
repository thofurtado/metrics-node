// Modelos que a tela "Regra de hora extra" oferece (D10): perguntas guiadas e sugestões. Nada aqui é obrigatório (D18).
// Fontes conferidas em 07/10/2026 (ESPEC-PONTO-REGRAS-E-BANCO-DE-HORAS.md e PARECER-PONTO-E-JORNADA-2026-10-07.md).

import { REGRA_CLT, RegraDaLoja } from './regra'

export interface ModeloSugerido {
  chave: RegraDaLoja['modelo']
  nome: string
  /** Para quem serve, em uma frase */
  paraQuem: string
  /** O que a loja precisa saber para escolher */
  explicacao: string[]
  /** Valores sugeridos (a loja pode mudar tudo) */
  valores: Partial<RegraDaLoja>
  /** Campos que a loja precisa conferir na convenção dela antes de salvar */
  conferir: string[]
  fonte: { texto: string; link: string } | null
}

export const MODELOS: ModeloSugerido[] = [
  {
    chave: 'CLT',
    nome: 'CLT (o mínimo da lei)',
    paraQuem: 'Para quem não segue convenção coletiva ou não sabe qual é a sua.',
    explicacao: [
      'Hora extra com 50% a mais, depois de 8 horas no dia ou de 44 horas na semana.',
      'Domingo e feriado trabalhados sem folga compensatória: 100%.',
      'Trabalho entre 22h e 5h: 20% a mais, com a hora noturna de 52 minutos e 30 segundos.',
      'Tolerância de 10 minutos por dia: passou disso, conta tudo.',
    ],
    valores: { ...REGRA_CLT },
    conferir: [],
    fonte: { texto: 'CLT, arts. 58, 59, 66 e 73 (site do Planalto)', link: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm' },
  },
  {
    chave: 'SP_BARES_RESTAURANTES',
    nome: 'Bares e restaurantes da cidade de São Paulo e região (Sindresbar e Sinthoresp)',
    paraQuem: 'Capital e 21 municípios da Grande SP (fora fast food da capital, que tem convenção própria, e fora hotéis).',
    explicacao: [
      'A empresa cadastrada no Sindresbar nas "condições especiais" ou "diferenciadas" paga hora extra de 50% ou 70% e adicional noturno de 20% ou 35%, conforme o caso: veja no comprovante do seu cadastro.',
      'Conta como extra o que passar da 8ª hora do dia ou da 44ª da semana.',
      'Gorjeta não entra na base da hora extra.',
    ],
    valores: { ...REGRA_CLT },
    conferir: ['Percentual da hora extra (50% ou 70%)', 'Percentual do adicional noturno (20% ou 35%)'],
    fonte: {
      texto: 'Informativo da Convenção Coletiva 2025/2027 (Sindresbar, 12/05/2025)',
      link: 'https://anrbrasil.org.br/wp-content/uploads/2025/07/INFORMATIVO-CCT-SINTHORESP-2025-2027-DATA-BASE-JULHO-DE-2025.pdf',
    },
  },
  {
    chave: 'LITORAL_NORTE',
    nome: 'Hotéis, bares e restaurantes do Litoral Norte de SP (SinHoRes e SECHSAR)',
    paraQuem: 'Ubatuba, Caraguatatuba, São Sebastião e Ilhabela.',
    explicacao: [
      'A empresa do Simples que aderiu ao REPIS tem banco de horas de até 12 meses, intervalo de 30 minutos a 4 horas e escala 12x36 combinada direto com o funcionário.',
      'Os percentuais de hora extra e de adicional noturno estão na convenção 2025/2027: confira e ajuste os campos abaixo.',
    ],
    valores: { ...REGRA_CLT },
    conferir: ['Percentual da hora extra', 'Percentual do adicional noturno', 'Se a empresa aderiu ao REPIS'],
    fonte: { texto: 'Convenções do SinHoRes Litoral Norte', link: 'https://sinhoreslitoralnorte.com.br/convencoes-coletivas/' },
  },
  {
    chave: 'PERSONALIZADO',
    nome: 'Do meu jeito (personalizado)',
    paraQuem: 'Para a loja que combina outros números com a equipe.',
    explicacao: [
      'Todos os campos ficam livres. Ao lado de cada um, o sistema mostra o que a lei pede, só como sugestão.',
    ],
    valores: { ...REGRA_CLT },
    conferir: [],
    fonte: null,
  },
]
