import { createPool } from 'mysql2/promise';

import './env_utils'

const pool = createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});

export async function runQuery(sql: string, values?: any): Promise<any | []> {
    let connection = await pool.getConnection();
    try {
        const [rows, _] = await connection.execute(sql, values)
        return rows as []
    } finally {
        connection.release();
    }
}