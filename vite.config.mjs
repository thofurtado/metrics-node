"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const vite_tsconfig_paths_1 = __importDefault(require("vite-tsconfig-paths"));
const dotenv_1 = __importDefault(require("dotenv"));

// Load test environment variables before anything else
dotenv_1.default.config({ path: '.env.test' });

exports.default = (0, config_1.defineConfig)({
    plugins: [(0, vite_tsconfig_paths_1.default)()],
    test: {
        environmentMatchGlobs: [
            ['src/http/controllers/**', 'prisma']
        ]
    }
});

