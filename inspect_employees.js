"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const employees = await prisma.employee.findMany({
        select: {
            name: true,
            isRegistered: true,
            hasCestaBasica: true
        }
    });
    fs_1.default.writeFileSync('employees_list.json', JSON.stringify(employees, null, 2));
    console.log("Data written to employees_list.json");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
