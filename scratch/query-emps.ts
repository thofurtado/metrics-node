import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const emps = await prisma.employee.findMany();
    const data = emps.map(e => ({ name: e.name, regType: e.registrationType, salary: e.salary, isReg: e.isRegistered, vt: e.transportAllowance, daily: e.dailyRate }));
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
