"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Replaces broken/sandboxed embed servers in existing DB records.
 * Run: npx ts-node scripts/fix-servers.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function main() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    const col = mongoose_1.default.connection.collection('movies');
    // Replace vidlink.pro with vidsrc.cc
    const res = await col.updateMany({ 'sources.url': { $regex: 'vidlink\\.pro' } }, [
        {
            $set: {
                sources: {
                    $map: {
                        input: '$sources',
                        as: 'src',
                        in: {
                            $cond: {
                                if: { $regexMatch: { input: '$$src.url', regex: 'vidlink\\.pro' } },
                                then: {
                                    $mergeObjects: [
                                        '$$src',
                                        {
                                            url: {
                                                $concat: [
                                                    'https://vidsrc.cc/v2/embed/movie/',
                                                    {
                                                        $arrayElemAt: [
                                                            { $split: ['$$src.url', '/movie/'] },
                                                            1,
                                                        ],
                                                    },
                                                ],
                                            },
                                            serverName: 'Server 4',
                                        },
                                    ],
                                },
                                else: '$$src',
                            },
                        },
                    },
                },
            },
        },
    ]);
    console.log(`✅ Updated ${res.modifiedCount} movies (vidlink.pro → vidsrc.cc)`);
    await mongoose_1.default.disconnect();
}
main().catch(err => { console.error(err); process.exit(1); });
