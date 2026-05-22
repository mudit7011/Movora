"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed script — inserts demo movies directly without TMDB API calls.
 * Data sourced from TMDB (poster/backdrop paths are from TMDB CDN).
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const W = 'https://image.tmdb.org/t/p/w500';
const O = 'https://image.tmdb.org/t/p/original';
function slug(title, year) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + year;
}
const MOVIES = [
    {
        tmdbId: '19404', title: 'Dilwale Dulhania Le Jayenge', year: 1995,
        language: ['Hindi'], genres: ['Romance', 'Drama'], rating: 8.5, runtime: 189,
        synopsis: "Raj is a rich, carefree, happy-go-lucky second generation NRI. Simran is the daughter of Chaudhary Baldev Singh, who in spite of being an NRI is very strict about adherence to Indian values. Simran has left for India to be married to her childhood fiancé.",
        poster: '/2CAL2433ZeIihfX1Hb2139CX0pW.jpg', backdrop: '/6N5d02quKqMKqvTpOdFmBDy9scY.jpg',
        trailer: 'Ix_sQbFpbPg',
        cast: [{ name: 'Shah Rukh Khan', character: 'Raj' }, { name: 'Kajol', character: 'Simran' }],
    },
    {
        tmdbId: '20453', title: '3 Idiots', year: 2009,
        language: ['Hindi'], genres: ['Comedy', 'Drama'], rating: 8.0, runtime: 170,
        synopsis: "Rascal. Joker. Dreamer. Genius... You've never met a college student quite like Rancho. From the moment he arrives at India's most prestigious university, his outlandish schemes turn the campus upside down.",
        poster: '/66A9MqXOyVFCssoloscw79z8Tew.jpg', backdrop: '/8gT3UKtglLVpu0YfccwbmXZ5Eis.jpg',
        trailer: 'xvszmNXdM4w',
        cast: [{ name: 'Aamir Khan', character: 'Rancho' }, { name: 'R. Madhavan', character: 'Farhan' }, { name: 'Sharman Joshi', character: 'Raju' }],
    },
    {
        tmdbId: '7508', title: 'Taare Zameen Par', year: 2007,
        language: ['Hindi'], genres: ['Drama'], rating: 8.0, runtime: 162,
        synopsis: "Ishaan Awasthi is an eight-year-old whose world is filled with wonders that no one else seems to appreciate. Colours, fish, dogs, and kites don't seem important to the adults.",
        poster: '/puHRt6Raovm5ujGCdwLWvRv4NHU.jpg', backdrop: '/bPwdy3zaNnMdZ22u0WCcYu0xxgt.jpg',
        trailer: 'DhSKGWBoBqE',
        cast: [{ name: 'Darsheel Safary', character: 'Ishaan' }, { name: 'Aamir Khan', character: 'Ram Shankar Nikumbh' }],
    },
    {
        tmdbId: '297222', title: 'PK', year: 2014,
        language: ['Hindi'], genres: ['Comedy', 'Drama', 'Science Fiction'], rating: 7.7, runtime: 153,
        synopsis: "A stranger in the city asks questions no one has asked before. Known only by his initials, the man's innocent questions and childlike curiosity take him on a journey of love, laughter and letting go.",
        poster: '/z2x2Y4tncefsIU7h82gmUM5vnBJ.jpg', backdrop: '/gxfvtq5eYiClS2X7hxAAPBNrbWA.jpg',
        trailer: 'wogHs5pG6kY',
        cast: [{ name: 'Aamir Khan', character: 'PK' }, { name: 'Anushka Sharma', character: 'Jagat Janani' }],
    },
    {
        tmdbId: '872906', title: 'Jawan', year: 2023,
        language: ['Hindi'], genres: ['Action', 'Thriller'], rating: 7.1, runtime: 169,
        synopsis: "An emotional journey of a prison warden, driven by a personal vendetta while keeping up to a promise made years ago, recruits inmates to commit outrageous crimes that shed light on corruption and injustice.",
        poster: '/jFt1gS4BGHlK8xt76Y81Alp4dbt.jpg', backdrop: '/mguy0nefEUY7NKruffpLO3Stj3d.jpg',
        trailer: 'MtiE2OFe7gA',
        cast: [{ name: 'Shah Rukh Khan', character: 'Vikram Rathore' }, { name: 'Nayanthara', character: 'Narmada Rai' }],
    },
    {
        tmdbId: '848116', title: 'Rocky Aur Rani Kii Prem Kahaani', year: 2023,
        language: ['Hindi'], genres: ['Comedy', 'Drama', 'Romance'], rating: 6.1, runtime: 168,
        synopsis: "Gym-freak brat Rocky falls in love with Rani, who comes from a well-educated Bengali family. The two decide to switch their families to adjust to each other's cultures.",
        poster: '/vTQIqlxUkOuyf2UKhlM2OUaFGKz.jpg', backdrop: '/61RYedFgX1K07xgVIvdJzukSR4g.jpg',
        trailer: '',
        cast: [{ name: 'Ranveer Singh', character: 'Rocky' }, { name: 'Alia Bhatt', character: 'Rani' }],
    },
    {
        tmdbId: '1291608', title: 'Dhurandhar', year: 2025,
        language: ['Hindi'], genres: ['Action', 'Crime', 'Thriller'], rating: 7.1, runtime: 140,
        synopsis: "A mysterious traveler slips into the heart of Karachi's underbelly and rises through its ranks with lethal precision, only to tear the notorious ISI-Underworld nexus apart from within.",
        poster: '/8FHOtUpNIk5ZPEay2N2EY5lrxkv.jpg', backdrop: '/4DfxcN4w0FuYZHQ3JAHzpHWia1U.jpg',
        trailer: '',
        cast: [{ name: 'Ranbir Kapoor', character: 'Hamza' }],
    },
    // English movies
    {
        tmdbId: '550', title: 'Fight Club', year: 1999,
        language: ['English'], genres: ['Drama', 'Thriller'], rating: 8.4, runtime: 139,
        synopsis: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy. Their concept catches on, with explosive results.",
        poster: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', backdrop: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
        trailer: 'qtRKdVHc-cE',
        cast: [{ name: 'Brad Pitt', character: 'Tyler Durden' }, { name: 'Edward Norton', character: 'The Narrator' }],
    },
    {
        tmdbId: '238', title: 'The Godfather', year: 1972,
        language: ['English'], genres: ['Drama', 'Crime'], rating: 8.7, runtime: 175,
        synopsis: "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family. When organized crime family patriarch, Vito Corleone barely survives an attempt on his life, his youngest son, Michael steps in to take care of the family business.",
        poster: '/3bhkrj58Vtu7enYsLegHnDmni2S.jpg', backdrop: '/tmU7GeKVybMWFbwcQntM21Qb9Ag.jpg',
        trailer: 'sY1S34973zA',
        cast: [{ name: 'Marlon Brando', character: 'Vito Corleone' }, { name: 'Al Pacino', character: 'Michael Corleone' }],
    },
    {
        tmdbId: '278', title: 'The Shawshank Redemption', year: 1994,
        language: ['English'], genres: ['Drama', 'Crime'], rating: 8.7, runtime: 142,
        synopsis: "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden.",
        poster: '/9cqNxx0GxF0bAY82PZ6gqnKohrQ.jpg', backdrop: '/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
        trailer: 'PLl99DlL6b4',
        cast: [{ name: 'Tim Robbins', character: 'Andy Dufresne' }, { name: 'Morgan Freeman', character: 'Ellis Boyd "Red" Redding' }],
    },
    // Hindi Dubbed
    {
        tmdbId: '76600', title: 'Avatar: The Way of Water', year: 2022,
        language: ['Hindi Dubbed', 'English'], genres: ['Science Fiction', 'Action', 'Adventure'], rating: 7.6, runtime: 192,
        synopsis: "Set more than a decade after the events of the first film, learn the story of the Sully family, the trouble that follows them, the lengths they go to keep each other safe, the battles they fight to stay alive, and the tragedies they endure.",
        poster: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', backdrop: '/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg',
        trailer: 'd9MyW72ELq0',
        cast: [{ name: 'Sam Worthington', character: 'Jake Sully' }, { name: 'Zoe Saldaña', character: 'Neytiri' }],
    },
    {
        tmdbId: '315162', title: 'Puss in Boots: The Last Wish', year: 2022,
        language: ['Hindi Dubbed', 'English'], genres: ['Animation', 'Adventure', 'Comedy'], rating: 8.0, runtime: 100,
        synopsis: "Puss in Boots discovers that his passion for adventure has taken its toll: he has burned through eight of his nine lives. To save himself, he must find the mythical Last Wish.",
        poster: '/kuf6dutpsT0vSVehic3EZIqkOBt.jpg', backdrop: '/l4QHerTSbMI7qgvasqxP36py3ON.jpg',
        trailer: 'tHb4bEBn9Rc',
        cast: [{ name: 'Antonio Banderas', character: 'Puss in Boots' }],
    },
];
async function seed() {
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    let count = 0;
    for (const m of MOVIES) {
        const doc = {
            tmdbId: m.tmdbId,
            title: m.title,
            slug: slug(m.title, m.year),
            type: 'movie',
            language: m.language,
            genres: m.genres,
            releaseYear: m.year,
            rating: m.rating,
            runtime: m.runtime,
            synopsis: m.synopsis,
            posterUrl: `${W}${m.poster}`,
            backdropUrl: `${O}${m.backdrop}`,
            trailerKey: m.trailer || undefined,
            cast: m.cast,
            sources: [{
                    serverName: 'Server 1',
                    url: `https://vidsrc.to/embed/movie/${m.tmdbId}`,
                    type: 'iframe',
                    quality: 'HD',
                    isWorking: true,
                }],
            scrapedFrom: 'seed-script',
            updatedAt: new Date(),
        };
        await mongoose_1.default.connection.collection('movies').updateOne({ tmdbId: doc.tmdbId }, { $set: doc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
        console.log(`✓ ${m.title} (${m.year}) [${m.language[0]}]`);
        count++;
    }
    console.log(`\n✅ ${count} movies seeded!`);
    await mongoose_1.default.disconnect();
}
seed().catch(console.error);
