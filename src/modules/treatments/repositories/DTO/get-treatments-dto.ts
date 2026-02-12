import { Treatment } from '@prisma/client'

export interface GetTreatmentDTO {
    treatments: Treatment[],
    totalCount: number,
    perPage: number,
    pageIndex: number
}
