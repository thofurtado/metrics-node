import { getCompetenceDate } from "./src/utils/get-competence-date"

function test() {
    const scenarios = [
        { name: "Sexta 22:00", date: new Date("2026-04-03T22:00:00"), expected: "2026-04-03" },
        { name: "Sábado 01:00 (Madrugada)", date: new Date("2026-04-04T01:00:00"), expected: "2026-04-03" },
        { name: "Sábado 03:59 (Limite)", date: new Date("2026-04-04T03:59:59"), expected: "2026-04-03" },
        { name: "Sábado 04:00 (Novo Dia)", date: new Date("2026-04-04T04:00:00"), expected: "2026-04-04" },
    ]

    console.log("Testing getCompetenceDate (Zero Trust logic verification):")
    scenarios.forEach(s => {
        const result = getCompetenceDate(s.date)
        const resultStr = result.getUTCFullYear() + '-' + 
                        String(result.getUTCMonth() + 1).padStart(2, '0') + '-' + 
                        String(result.getUTCDate()).padStart(2, '0')
        const success = resultStr === s.expected
        console.log(`[${success ? 'OK' : 'FAIL'}] ${s.name}: ${s.date.toISOString()} -> ${resultStr} (Exp: ${s.expected})`)
    })
}

test()
