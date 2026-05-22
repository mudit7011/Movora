"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const Admin_1 = require("../src/models/Admin");
const env_1 = require("../src/config/env");
async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpass npx ts-node scripts/seed-admin.ts');
        process.exit(1);
    }
    await mongoose_1.default.connect(env_1.env.MONGODB_URI);
    const existing = await Admin_1.Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
        console.log(`Admin already exists: ${email}`);
        await mongoose_1.default.disconnect();
        return;
    }
    const passwordHash = await bcrypt_1.default.hash(password, 12);
    await Admin_1.Admin.create({ email: email.toLowerCase(), passwordHash, role: 'superadmin' });
    console.log(`✅ Admin created: ${email}`);
    await mongoose_1.default.disconnect();
}
seedAdmin().catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
