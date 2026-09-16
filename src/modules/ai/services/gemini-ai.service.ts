import axios from 'axios'
import { z } from 'zod'

export interface ItemForAiMatching {
    codigo: string
    nome: string
    unidade: string
    quantidade: number
    valorUnitario: number
}

export interface CandidateItem {
    id: string
    name: string
    unit?: string | null
    type: 'SUPPLY' | 'PRODUCT'
}

export interface AiMatchSuggestion {
    item_code: string
    matched_id: string | null
    matched_type: 'SUPPLY' | 'PRODUCT' | null
    matched_name: string | null
    conversion_factor: number
    confidence: number
    reasoning: string
}

const aiResponseSchema = z.object({
    suggestions: z.array(z.object({
        item_code: z.string(),
        matched_id: z.string().nullable().optional(),
        matched_type: z.enum(['SUPPLY', 'PRODUCT']).nullable().optional(),
        matched_name: z.string().nullable().optional(),
        conversion_factor: z.number().positive().default(1.0),
        confidence: z.number().min(0).max(1).default(0.5),
        reasoning: z.string().default('')
    }))
})

export class GeminiAiService {
    /**
     * Realiza o match semântico e cálculo do fator de conversão de unidades
     * de forma isolada, tipada e segura.
     */
    public async matchNfeItems(
        nfeItems: ItemForAiMatching[],
        candidates: CandidateItem[],
        customApiKey?: string | null,
        model: string = 'gemini-1.5-flash'
    ): Promise<AiMatchSuggestion[]> {
        const apiKey = customApiKey || process.env.GEMINI_API_KEY

        // Fallback heurístico se não houver chave de API configurada
        if (!apiKey) {
            console.warn('[Gemini AI] Nenhuma chave GEMINI_API_KEY configurada. Utilizando fallback heurístico local.')
            return this.heuristicFallback(nfeItems, candidates)
        }

        const prompt = `Você é um assistente especialista em controle de estoque e conversão de notas fiscais (NFe) para restaurantes e bares.
Sua missão estrita é analisar os itens faturados na nota fiscal de compra e encontrar o insumo ou produto correspondente no sistema, calculando o FATOR DE CONVERSÃO DE UNIDADE.

REGRAS CRÍTICAS DE CONVERSÃO:
1. O fator de conversão (conversion_factor) é o multiplicador que transforma 1 unidade comercial da nota fiscal (uCom) na unidade de controle de estoque do restaurante.
2. Exemplos obrigatórios de raciocínio:
   - Se a nota traz "CHULETA BOVINA CX 20KG" com unidade "CX" e o insumo no restaurante é estocado em "KG", o fator é 20 (1 caixa = 20 kg).
   - Se a nota traz "CERVEJA HEINEKEN LATA FD 12UN" com unidade "FD" e o produto é estocado em "UN", o fator é 12 (1 fardo = 12 unidades).
   - Se a nota traz "QUEIJO MUSSARELA KG" com unidade "KG" e o insumo é estocado em "KG", o fator é 1.0.
   - Se a nota traz "PEÇA PICANHA 2.5KG" com unidade "PC" e o insumo é "KG", o fator é 2.5.
3. Se não houver correspondência plausível com nenhum insumo da lista de candidatos, retorne matched_id: null e confidence: 0.

ITENS DA NOTA FISCAL DE COMPRA:
${JSON.stringify(nfeItems, null, 2)}

INSUMOS E PRODUTOS CADASTRADOS NO SISTEMA:
${JSON.stringify(candidates.slice(0, 200), null, 2)}

Retorne OBRIGATORIAMENTE um JSON válido correspondente ao schema:
{
  "suggestions": [
    {
      "item_code": "código do item na nota",
      "matched_id": "UUID do insumo/produto escolhido ou null",
      "matched_type": "SUPPLY" ou "PRODUCT" ou null,
      "matched_name": "Nome do insumo/produto correspondente ou null",
      "conversion_factor": número positivo (ex: 20.0, 1.0, 12.0),
      "confidence": número entre 0 e 1,
      "reasoning": "explicação curta do cálculo do fator"
    }
  ]
}`

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
            const response = await axios.post(
                url,
                {
                    contents: [
                        {
                            parts: [{ text: prompt }]
                        }
                    ],
                    generationConfig: {
                        response_mime_type: 'application/json',
                        temperature: 0.1
                    }
                },
                {
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const textOutput = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
            if (!textOutput) {
                throw new Error('Resposta vazia da API do Gemini.')
            }

            const parsedJson = JSON.parse(textOutput)
            const validated = aiResponseSchema.parse(parsedJson)

            return validated.suggestions.map(s => ({
                item_code: s.item_code,
                matched_id: s.matched_id || null,
                matched_type: s.matched_type || null,
                matched_name: s.matched_name || null,
                conversion_factor: s.conversion_factor,
                confidence: s.confidence,
                reasoning: s.reasoning || ''
            }))

        } catch (error: any) {
            console.error('[Gemini AI] Erro ao consultar API:', error?.response?.data || error.message)
            return this.heuristicFallback(nfeItems, candidates)
        }
    }

    /**
     * Fallback rápido sem IA caso o serviço esteja offline ou sem chave
     */
    private heuristicFallback(nfeItems: ItemForAiMatching[], candidates: CandidateItem[]): AiMatchSuggestion[] {
        return nfeItems.map(item => {
            const itemLower = item.nome.toLowerCase()
            
            // Busca por similaridade simples de nome
            const match = candidates.find(c => {
                const cLower = c.name.toLowerCase()
                return itemLower.includes(cLower) || cLower.includes(itemLower)
            })

            // Tenta detectar fator simples de pacote (ex: "CX 20", "FD 12", "C/ 10")
            let factor = 1.0
            const factorMatch = item.nome.match(/(?:cx|fd|c\/|pack|cxa)\s*(\d+(?:[.,]\d+)?)/i)
            if (factorMatch && factorMatch[1]) {
                factor = parseFloat(factorMatch[1].replace(',', '.'))
            }

            return {
                item_code: item.codigo,
                matched_id: match ? match.id : null,
                matched_type: match ? match.type : null,
                matched_name: match ? match.name : null,
                conversion_factor: factor > 0 ? factor : 1.0,
                confidence: match ? 0.6 : 0.0,
                reasoning: match 
                    ? `Correspondência aproximada por nome: ${match.name}` 
                    : 'Nenhum insumo semelhante encontrado automaticamente.'
            }
        })
    }
}
