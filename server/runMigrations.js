import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() 
{
    const client = await pool.connect();

    try 
    {
        console.log('Iniciando migrations...');

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).sort();

        for (const file of files) 
        {
            if (!file.endsWith('.sql')) continue;

            console.log(`Executando migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            await client.query(sql);
            console.log(`✓ ${file} concluído`);
        }

        console.log('Todas as migrations foram executadas com sucesso!');
    } 
    catch (error) 
    {
        console.error('Erro ao executar migrations:', error);
        throw error;
    } 
    finally 
    {
        client.release();
        await pool.end();
    }
}

runMigrations();
