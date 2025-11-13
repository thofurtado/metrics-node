export interface DailyBalance {
    date: string // formato: YYYY-MM-DD
    balance: number
    isProjection: boolean
}

export interface BalanceProjectionData {
    currentBalance: number
    dailyBalances: DailyBalance[]
}

export interface BalanceProjectionRepository {
    getBalanceProjection(days?: number): Promise<BalanceProjectionData>
}