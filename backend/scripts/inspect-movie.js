"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
mongoose_1.default.connect(process.env.MONGODB_URI).then(async () => {
    const m = await mongoose_1.default.connection.db.collection('movies').findOne({ releaseYear: { $gte: 2025 }, rating: { $gte: 8 } });
    if (m) {
        const skip = new Set(['sources', 'cast', 'synopsis', 'posterUrl', 'backdropUrl', 'trailerKey']);
        const out = {};
        for (const k of Object.keys(m)) {
            if (!skip.has(k))
                out[k] = m[k];
        }
        console.log(JSON.stringify(out, null, 2));
    }
    await mongoose_1.default.disconnect();
});
