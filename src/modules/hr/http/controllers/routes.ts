import { FastifyInstance } from "fastify"
import { getStatus, register, syncOffline } from "./time-clock"
import { listTimeClocks, updateTimeClock, upsertTimeClock, bulkUpsertTimeClocks } from "./time-clocks-admin"
import { createEmployee, listEmployees, updateEmployee, getEmployeeSummary, syncEmployees } from "./employees"
import { calculateRateio, confirmPayroll, createPayrollEntry, generatePayrollBatch, deletePayrollBatch, getPayrollPreview, getEmployeePayrollEntries, listPendingDebts, updatePayrollEntry, calculateRateioExtras, getPayrollHistory, cancelPayrollEntry } from "./payroll"
import { listHolidays, createCustomHoliday, removeHoliday } from "./holidays"
import { listEmployeeGroups, createEmployeeGroup, updateEmployeeGroup, deleteEmployeeGroup } from "./employee-groups"
import { apurar, obterRegra, resumo, salvarRegra } from "./ponto"
import { verifyModuleAccess } from "@/http/middlewares/verify-module-access"

// Fase 0 do Mergulho (17:U1): trava do módulo RH nas rotas de administração. Exceções que telas do Financeiro usam:
// a lista de funcionários (baixa do vale em "Clientes a Prazo") e os feriados (vencimento em dia útil, que não é
// dado sigiloso). As rotas do quiosque acima ficam fora (chave do Ponto, sem usuário).
const travaRH = verifyModuleAccess("hr")
const travaRHouFinanceiro = verifyModuleAccess("hr", "finance")

// Rotas do Quiosque (Electron) - autenticadas via x-api-key
export async function kioskRoutes(app: FastifyInstance) {
    app.get("/hr/time-clock/status", getStatus)
    app.post("/hr/time-clock/register", register)
    app.post("/hr/time-clock/sync-offline", syncOffline)
    app.get("/hr/employees/sync", syncEmployees)
}

// Rotas Admin (Painel Metrics) - autenticadas via JWT
export async function hrAdminRoutes(app: FastifyInstance) {
    app.addHook("onRequest", async (request, reply) => {
        const rota = `${request.method} ${request.routeOptions.url}`
        if (rota === "GET /hr/holidays") return
        if (rota === "GET /hr/employees") return travaRHouFinanceiro(request, reply)
        return travaRH(request, reply)
    })
    app.get("/hr/time-clocks", listTimeClocks)
    app.put("/hr/time-clocks/:id", updateTimeClock)
    app.post("/hr/time-clocks/upsert", upsertTimeClock)
    app.post("/hr/time-clocks/bulk", bulkUpsertTimeClocks)

    app.get("/hr/employees", listEmployees)
    app.get("/hr/employees/summary", getEmployeeSummary)
    app.post("/hr/employees", createEmployee)
    app.put("/hr/employees/:id", updateEmployee)

    // Grupos de funcionários (o cargo virou cadastro; o grupo libera o app do garçom e/ou o PDV)
    app.get("/hr/employee-groups", listEmployeeGroups)
    app.post("/hr/employee-groups", createEmployeeGroup)
    app.put("/hr/employee-groups/:id", updateEmployeeGroup)
    app.delete("/hr/employee-groups/:id", deleteEmployeeGroup)

    app.post("/hr/payroll/rateio", calculateRateio)
    app.get("/hr/payroll/extras-preview", calculateRateioExtras)
    app.post("/hr/payroll/batch", generatePayrollBatch)
    app.delete("/hr/payroll/batch", deletePayrollBatch)
    app.get("/hr/payroll/preview", getPayrollPreview)
    app.get("/hr/payroll/history", getPayrollHistory)
    app.post("/hr/payroll/confirm", confirmPayroll)
    app.post("/hr/payroll/entries", createPayrollEntry)
    app.put("/hr/payroll/entries/:id", updatePayrollEntry)
    app.get("/hr/employees/:id/payroll", getEmployeePayrollEntries)
    app.get("/hr/employees/:id/pending-debts", listPendingDebts)
    app.delete("/hr/payroll/entries/:id", cancelPayrollEntry)

    // Conta única do ponto e regra de hora extra da loja (08/10/2026)
    app.get("/hr/ponto/regra", obterRegra)
    app.post("/hr/ponto/regra", salvarRegra)
    app.post("/hr/ponto/apurar", apurar)
    app.get("/hr/ponto/resumo", resumo)

    // Feriados
    app.get("/hr/holidays", listHolidays)
    app.post("/hr/holidays", createCustomHoliday)
    app.delete("/hr/holidays/:id", removeHoliday)
}
