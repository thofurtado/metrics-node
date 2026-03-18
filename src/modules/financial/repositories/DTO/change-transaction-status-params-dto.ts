export interface ChangeTransactionStatusParams {
    id: string
    amount: number
    date: Date
    account_id?: string
    payment_method?: string
}