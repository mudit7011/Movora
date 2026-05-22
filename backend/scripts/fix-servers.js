"use strict";
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// URLs to remove entirely
const BAD_PATTERNS = ['2embed.cc', 'vidsrc.icu', 'vidlink.pro'];

// Preferred order for remaining servers
const SERVER_ORDER = ['embed.su', 'videasy', 'vidsrc.cc'];

function reorderSources(sources) {
  // Remove bad servers
  const filtered = sources.filter(s => !BAD_PATTERNS.some(bad => s.url.includes(bad)));
  // Deduplicate by URL
  const seen = new Set();
  const unique = filtered.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
  // Sort by preferred order
  unique.sort((a, b) => {
    const ai = SERVER_ORDER.findIndex(k => a.url.includes(k));
    const bi = SERVER_ORDER.findIndex(k => b.url.includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return unique.map((s, i) => ({ ...s, name: `Server ${i + 1}` }));
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const col = mongoose.connection.collection('movies');
  const total = await col.countDocuments({ sources: { $exists: true } });
  console.log(`Processing ${total} documents...`);

  let updated = 0;
  const cursor = col.find({ sources: { $exists: true } });

  for await (const doc of cursor) {
    const original = doc.sources ?? [];
    const cleaned = reorderSources(original);

    const changed =
      cleaned.length !== original.length ||
      cleaned.some((s, i) => s.url !== original[i]?.url || s.name !== original[i]?.name);

    if (changed) {
      await col.updateOne({ _id: doc._id }, { $set: { sources: cleaned } });
      updated++;
      if (updated % 200 === 0) process.stdout.write(`\r  Updated ${updated}...`);
    }
  }

  console.log(`\nDone — updated ${updated} / ${total} documents`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
