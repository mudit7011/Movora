"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthRouter = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const Admin_1 = require("../../models/Admin");
const env_1 = require("../../config/env");
const rateLimiter_1 = require("../../middleware/rateLimiter");
const router = (0, express_1.Router)();
exports.adminAuthRouter = router;
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
const cookieOptions = {
    httpOnly: true,
    secure: env_1.env.NODE_ENV === 'production',
    sameSite: 'strict',
};
router.post('/login', rateLimiter_1.loginRateLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid input' });
        return;
    }
    try {
        const { email, password } = parsed.data;
        const admin = await Admin_1.Admin.findOne({ email: email.toLowerCase() });
        if (!admin) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, admin.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ adminId: admin._id.toString() }, env_1.env.JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
        res.json({ message: 'Logged in', token });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/logout', (_req, res) => {
    res.clearCookie('token', cookieOptions);
    res.json({ message: 'Logged out' });
});
