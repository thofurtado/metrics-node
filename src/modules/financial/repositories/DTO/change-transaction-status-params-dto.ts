export interface ChangeTransactionStatusParams {
    id: string
    amount: number
    interest?: number
    discount?: number
    date: Date
    account_id?: string
    payment_method?: string
}