import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export function createPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'airbnb',
    password: process.env.DB_PASSWORD || 'airbnbpassword',
    database: process.env.DB_NAME || 'airbnb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  return pool;
}
