export interface ChangeTransactionStatusParams {
    id: string
    amount: number
    totalValue: number
    interest?: number
    fine?: number
    discount?: number
    date: Date
    account_id?: string
    payment_method?: string
}