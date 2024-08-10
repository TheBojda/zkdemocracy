import fs from 'fs';
import * as path from 'path';
import { runQuery } from '../src/utils/db_utils'

const main = async () => {
    await runQuery(`CREATE TABLE IF NOT EXISTS migrations (migration VARCHAR(255))`)

    const files = fs.readdirSync(path.join(process.cwd(), './database'))
    files.sort()
    for (const file of files) {
        const rows = await runQuery("SELECT migration FROM migrations WHERE migration = ?", [file])
        if (rows.length == 0) {
            console.log(`Running migration: ${file}`);
            const content = fs.readFileSync(path.join(process.cwd(), `./database/${file}`), 'utf-8').toString()
            await runQuery(content);
            await runQuery("INSERT INTO migrations VALUES (?)", [file]);
        }
    }
}

main().then(() => {
    console.log("Migrations complete.");
    process.exit(0);
}).catch((error) => {
    console.error("Error during migrations:", error);
    process.exit(1);
});
