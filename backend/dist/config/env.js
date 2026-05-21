"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
// In test mode the runner injects env vars directly; skip file loading so that
// tests that deliberately delete a var (to test validation) still throw.
if (process.env.NODE_ENV !== 'test') {
    // Load .env from project root (one level above backend/), then fall back to cwd.
    // Never override vars that are already set (e.g. CI secrets).
    dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env'), override: false });
    dotenv_1.default.config({ override: false }); // fallback: cwd .env
}
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().default('3001'),
    MONGODB_URI: zod_1.z.string().min(1, 'MONGODB_URI is required'),
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    TMDB_API_KEY: zod_1.z.string().min(1, 'TMDB_API_KEY is required'),
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:3000'),
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
});
exports.env = envSchema.parse(process.env);
