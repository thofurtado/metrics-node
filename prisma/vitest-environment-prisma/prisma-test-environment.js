"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const pg_1 = require("pg");
function generateDatabaseURL(schema) {
    if (!process.env.DATABASE_URL) {
        throw new Error('Please provide a DATABASE_URL environment variable.');
    }
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.set('schema', schema);
    return url.toString();
}
exports.default = {
    name: 'prisma',
    transformMode: 'ssr',
    async setup() {
        const schema = (0, node_crypto_1.randomUUID)();
        const databaseURL = generateDatabaseURL(schema);
        process.env.DATABASE_URL = databaseURL;
        (0, node_child_process_1.execSync)('npx prisma migrate deploy', { env: process.env });
        return {
            async teardown() {
                const client = new pg_1.Client({
                    connectionString: databaseURL,
                });
                await client.connect();
                await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
                await client.end();
            },
        };
    },
};
