const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('Setting up database...');
  
  // First, connect to PostgreSQL without specifying a database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default postgres database
  });

  try {
    // Check if the database exists
    const dbExists = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || 'messaging_system']
    );

    if (dbExists.rows.length === 0) {
      console.log(`Creating database: ${process.env.DB_NAME || 'messaging_system'}`);
      await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME || 'messaging_system'}`);
      console.log('Database created successfully!');
    } else {
      console.log('Database already exists.');
    }

    await adminPool.end();

    // Now connect to the messaging_system database
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'messaging_system',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    // Read and execute the SQL schema
    const sqlPath = path.join(__dirname, 'config', 'database.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Creating tables...');
    await pool.query(sqlContent);
    console.log('Tables created successfully!');

    await pool.end();
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up database:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Check your DB_PASSWORD in the .env file');
    console.log('3. Make sure the postgres user has permission to create databases');
    process.exit(1);
  }
}

setupDatabase(); 