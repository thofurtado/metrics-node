import { XMLParser } from 'fast-xml-parser'

export interface ParsedNfeHeader {
    chaveNfe: string
    numeroNota: string
    serie: string
    dataEmissao: string
    fornecedor: {
        cnpj: string
        razaoSocial: string
        nomeFantasia?: string
        ie?: string
        cidade?: string
        uf?: string
    }
    total: {
        valorProdutos: number
        valorFrete: number
        valorDesconto: number
        valorNota: number
    }
}

export interface ParsedNfeItem {
    numeroItem: number
    codigo: string
    ean?: string
    nome: string
    ncm: string
    cfop: string
    unidade: string
    quantidade: number
    valorUnitario: number
    valorTotal: number
}

export interface ParsedNfeResult {
    header: ParsedNfeHeader
    items: ParsedNfeItem[]
}

export class NfeParserService {
    private parser: XMLParser

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            allowBooleanAttributes: true,
            parseTagValue: false, // Keep raw strings to avoid losing leading zeroes or precision
            trimValues: true,
        })
    }

    public parse(xmlContent: string): ParsedNfeResult {
        if (!xmlContent || typeof xmlContent !== 'string') {
            throw new Error('Conteúdo do XML da NFe inválido ou vazio.')
        }

        const jsonObj = this.parser.parse(xmlContent)

        // Localiza a tag infNFe que pode estar dentro de nfeProc -> NFe ou diretamente em NFe
        const nfe = jsonObj.nfeProc?.NFe || jsonObj.NFe
        if (!nfe || !nfe.infNFe) {
            throw new Error('Estrutura de NFe SEFAZ não encontrada no arquivo XML.')
        }

        const infNFe = nfe.infNFe
        const ide = infNFe.ide || {}
        const emit = infNFe.emit || {}
        const totalICMS = infNFe.total?.ICMSTot || {}

        // 1. Extração da Chave de Acesso (44 dígitos)
        let rawId = infNFe['@_Id'] || ''
        if (rawId.startsWith('NFe')) rawId = rawId.slice(3)

        const header: ParsedNfeHeader = {
            chaveNfe: rawId,
            numeroNota: String(ide.nNF || ''),
            serie: String(ide.serie || '1'),
            dataEmissao: String(ide.dhEmi || ide.dEmi || new Date().toISOString()),
            fornecedor: {
                cnpj: String(emit.CNPJ || emit.CPF || ''),
                razaoSocial: String(emit.xNome || ''),
                nomeFantasia: emit.xFant ? String(emit.xFant) : undefined,
                ie: emit.IE ? String(emit.IE) : undefined,
                cidade: emit.enderEmit?.xMun ? String(emit.enderEmit.xMun) : undefined,
                uf: emit.enderEmit?.UF ? String(emit.enderEmit.UF) : undefined,
            },
            total: {
                valorProdutos: parseFloat(totalICMS.vProd || '0'),
                valorFrete: parseFloat(totalICMS.vFrete || '0'),
                valorDesconto: parseFloat(totalICMS.vDesc || '0'),
                valorNota: parseFloat(totalICMS.vNF || '0'),
            }
        }

        // 2. Extração dos Itens (<det>)
        let rawDets = infNFe.det
        if (!rawDets) {
            throw new Error('Nenhum item (<det>) encontrado no XML da NFe.')
        }

        if (!Array.isArray(rawDets)) {
            rawDets = [rawDets]
        }

        const items: ParsedNfeItem[] = rawDets.map((det: any, index: number) => {
            const prod = det.prod || {}
            return {
                numeroItem: parseInt(det['@_nItem'] || String(index + 1), 10),
                codigo: String(prod.cProd || ''),
                ean: (prod.cEAN && prod.cEAN !== 'SEM GTIN') ? String(prod.cEAN) : undefined,
                nome: String(prod.xProd || ''),
                ncm: String(prod.NCM || ''),
                cfop: String(prod.CFOP || ''),
                unidade: String(prod.uCom || 'UN').toUpperCase(),
                quantidade: parseFloat(prod.qCom || '0'),
                valorUnitario: parseFloat(prod.vUnCom || '0'),
                valorTotal: parseFloat(prod.vProd || '0'),
            }
        })

        return {
            header,
            items,
        }
    }
}
