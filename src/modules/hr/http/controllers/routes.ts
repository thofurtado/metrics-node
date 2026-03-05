import { FastifyInstance } from "fastify"
import { getStatus, register } from "./time-clock"
import { listTimeClocks, updateTimeClock, upsertTimeClock, bulkUpsertTimeClocks } from "./time-clocks-admin"
import { createEmployee, listEmployees, updateEmployee, getEmployeeSummary, syncEmployees } from "./employees"
import { calculateRateio, confirmPayroll, createPayrollEntry, generatePayrollBatch, deletePayrollBatch, getPayrollPreview, getEmployeePayrollEntries, listPendingDebts, updatePayrollEntry, calculateRateioExtras, getPayrollHistory } from "./payroll"

// Rotas do Quiosque (Electron) - autenticadas via x-api-key
export async function kioskRoutes(app: FastifyInstance) {
    app.get("/hr/time-clock/status", getStatus)
    app.post("/hr/time-clock/register", register)
    app.get("/hr/employees/sync", syncEmployees)
}

// Rotas Admin (Painel Metrics) - autenticadas via JWT
export async function hrAdminRoutes(app: FastifyInstance) {
    app.get("/hr/time-clocks", listTimeClocks)
    app.put("/hr/time-clocks/:id", updateTimeClock)
    app.post("/hr/time-clocks/upsert", upsertTimeClock)
    app.post("/hr/time-clocks/bulk", bulkUpsertTimeClocks)

    app.get("/hr/employees", listEmployees)
    app.get("/hr/employees/summary", getEmployeeSummary)
    app.post("/hr/employees", createEmployee)
    app.put("/hr/employees/:id", updateEmployee)

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
}
