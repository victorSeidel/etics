import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// export const pool = new Pool({ connectionString: process.env.PGURL });

export const pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
});

pool.on("connect", () => console.log("Conectado ao PostgreSQL"));
pool.on("error", (err) => console.error("Erro no PostgreSQL:", err));