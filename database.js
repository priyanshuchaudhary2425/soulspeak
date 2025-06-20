import pg from "pg";

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect();

async function createTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS contentData (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id),
        category TEXT,
        title TEXT,
        body TEXT
      );
    `);

    console.log("✅ Tables created or already exist.");
  } catch (err) {
    console.error("❌ Error creating tables:", err.stack);
  }
}

export { db, createTables };
