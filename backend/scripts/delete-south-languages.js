"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const REMOVE_LANGS = ['Telugu', 'Tamil', 'Malayalam', 'Kannada'];
async function run() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const count = await mongoose_1.default.connection.db
        .collection('movies')
        .countDocuments({ language: { $in: REMOVE_LANGS } });
    console.log(`Found ${count} movies with languages: ${REMOVE_LANGS.join(', ')}`);
    if (count === 0) {
        console.log('Nothing to delete.');
        await mongoose_1.default.disconnect();
        return;
    }
    const result = await mongoose_1.default.connection.db
        .collection('movies')
        .deleteMany({ language: { $in: REMOVE_LANGS } });
    console.log(`Deleted ${result.deletedCount} movies.`);
    await mongoose_1.default.disconnect();
    console.log('Done.');
}
run().catch(console.error);
