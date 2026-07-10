const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');

let dbConnection = null;

async function getDb() {
  if (dbConnection) return dbConnection;

  dbConnection = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign key support
  await dbConnection.run('PRAGMA foreign_keys = ON');

  return dbConnection;
}

async function initializeDatabase() {
  const db = await getDb();

  console.log('Initializing SQLite database...');

  // Create Users Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create Posts Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      media_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create Comments Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Create Likes Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      UNIQUE(user_id, post_id)
    )
  `);

  // Create Follows Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(follower_id, following_id)
    )
  `);

  // Check if database is empty, seed it if so
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('Seeding initial database data...');
    
    // Default password for seed accounts is 'password123'
    const passwordHash = await bcrypt.hash('password123', 10);

    // Insert Users
    const users = [
      {
        username: 'alex_vibe',
        email: 'alex@sphere.net',
        password_hash: passwordHash,
        display_name: 'Alex Mercer',
        bio: 'Designing the future of connection. Coffee addict, dark mode enthusiast, and creator of Sphere. 🚀',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
        cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'
      },
      {
        username: 'sophia_art',
        email: 'sophia@sphere.net',
        password_hash: passwordHash,
        display_name: 'Sophia Sterling',
        bio: 'Digital artist & UX researcher. Crafting vibrant virtual realms. Check out my latest render! 🎨✨',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
        cover_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80'
      },
      {
        username: 'cyber_explorer',
        email: 'leo@sphere.net',
        password_hash: passwordHash,
        display_name: 'Leo Vance',
        bio: 'Midnight coder. Linux rice customization. Cyberpunk aesthetic. In search of the perfect mechanical keyboard. 💻🎹',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        cover_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80'
      }
    ];

    const insertedUserIds = [];
    for (const u of users) {
      const result = await db.run(
        `INSERT INTO users (username, email, password_hash, display_name, bio, avatar_url, cover_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.username, u.email, u.password_hash, u.display_name, u.bio, u.avatar_url, u.cover_url]
      );
      insertedUserIds.push(result.lastID);
    }

    const [alexId, sophiaId, leoId] = insertedUserIds;

    // Insert Posts
    const posts = [
      {
        user_id: alexId,
        content: 'Welcome to Sphere! 🌐 A minimalist, high-fidelity space designed to share thoughts, showcase work, and connect. Built using vanilla JS and Express. How do you like the glassmorphic dark interface? Let me know below!',
        media_url: null
      },
      {
        user_id: sophiaId,
        content: 'Just finished my latest digital artwork: "Neon Synthetics". Playing around with glowing purples and deep cyan tones. Let me know what you think! 💜🩵 #digitalart #blender3d',
        media_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80'
      },
      {
        user_id: leoId,
        content: 'Midnight coding vibes. Got my coffee, my synthwave playlist, and my IDE in full dark mode. Productivity is peaking. ☕🎧 #buildinpublic #javascript',
        media_url: null
      }
    ];

    const insertedPostIds = [];
    for (const p of posts) {
      const result = await db.run(
        `INSERT INTO posts (user_id, content, media_url) VALUES (?, ?, ?)`,
        [p.user_id, p.content, p.media_url]
      );
      insertedPostIds.push(result.lastID);
    }

    const [post1Id, post2Id, post3Id] = insertedPostIds;

    // Insert Comments
    await db.run(
      `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
      [post1Id, sophiaId, 'This UI looks stunning, Alex! The backdrop blur transitions are so smooth. 💖']
    );
    await db.run(
      `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
      [post1Id, leoId, 'Agreed. Dark theme is spot on. Very easy on the eyes. 🕶️']
    );
    await db.run(
      `INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)`,
      [post2Id, alexId, 'Wow Sophia, the composition of "Neon Synthetics" is incredible. The gradients are beautiful!']
    );

    // Insert Likes
    await db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [sophiaId, post1Id]);
    await db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [leoId, post1Id]);
    await db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [alexId, post2Id]);
    await db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [leoId, post2Id]);

    // Insert Follows (Alex follows Sophia, Sophia follows Alex, Leo follows Alex & Sophia)
    await db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [alexId, sophiaId]);
    await db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [sophiaId, alexId]);
    await db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [leoId, alexId]);
    await db.run(`INSERT INTO follows (follower_id, following_id) VALUES (?, ?)`, [leoId, sophiaId]);

    console.log('Database seeded successfully.');
  }
}

module.exports = {
  getDb,
  initializeDatabase
};
