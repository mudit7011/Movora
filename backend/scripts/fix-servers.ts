/**
 * Replaces broken/sandboxed embed servers in existing DB records.
 * Run: npx ts-node scripts/fix-servers.ts
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!)
  console.log('Connected to MongoDB')

  const col = mongoose.connection.collection('movies')

  // Replace vidlink.pro with vidsrc.cc
  const res = await col.updateMany(
    { 'sources.url': { $regex: 'vidlink\\.pro' } },
    [
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
    ],
  )

  console.log(`✅ Updated ${res.modifiedCount} movies (vidlink.pro → vidsrc.cc)`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
