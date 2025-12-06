import path from 'path';
import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';
import { schema } from './pgDatabaseModel';

dotenv.config({ path: path.join(__dirname, `.env.${process.env.NODE_ENV}`) });

interface PrimaryKey {
    table: string;
    column: string;
}

interface ForeignKey {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    onDelete: string;
    constraintName: string;
}

const primaryKeys: PrimaryKey[] = [
	{ table: process.env.TABLE_BEATMAP!, column: 'id' },
	{ table: process.env.TABLE_BEATMAPSET!, column: 'id' },
];

const foreignKeys: ForeignKey[] = [
	{
		sourceTable: process.env.TABLE_BEATMAP!,
		sourceColumn: 'beatmapset_id',
		targetTable: process.env.TABLE_BEATMAPSET!,
		targetColumn: 'id',
		onDelete: 'CASCADE',
		constraintName: 'fk_beatmapset_id',
	},
];

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
	const res = await client.query(
		`SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name = $1
		)`,
		[tableName]
	);
	return res.rows[0].exists;
}

async function getTableColumns(client: PoolClient, tableName: string): Promise<string[]> {
	const res = await client.query(
		`SELECT column_name FROM information_schema.columns 
		 WHERE table_schema = 'public' AND table_name = $1`,
		[tableName]
	);
	return res.rows.map((r: { column_name: string }) => r.column_name);
}

function extractColumnDefinitions(schemaSQL: string): Record<string, string> {
	const createStmt = schemaSQL.match(/CREATE TABLE[^;]+;/s);
	if (!createStmt) return {};
	const cols = createStmt[0]
		.split('\n')
		.map((l: string) => l.trim())
		.filter((l: string) => l && !l.startsWith('CREATE TABLE') && !l.startsWith(')') && !l.startsWith('ALTER') && !l.startsWith('CONSTRAINT'))
		.map((l: string) => l.replace(/,$/, ''));
	const defs: Record<string, string> = {};
	for (const line of cols) {
		const [col] = line.split(/\s+/);
		defs[col.replace(/["`]/g, '')] = line;
	}
	return defs;
}

async function ensurePrimaryKeys(client: PoolClient): Promise<void> {
	for (const pk of primaryKeys) {
		const constraintName = `${pk.table}_pkey`;
		const exists = await client.query(
			`SELECT 1 
			 FROM information_schema.table_constraints
			 WHERE table_schema='public'
			   AND table_name=$1
			   AND constraint_name=$2
			   AND constraint_type='PRIMARY KEY'`,
			[pk.table, constraintName]
		);

		if (exists.rowCount === 0) {
			console.log(`Adding primary key on ${pk.table}(${pk.column})`);
			await client.query(`
				ALTER TABLE public.${pk.table} 
				ADD CONSTRAINT ${constraintName} PRIMARY KEY (${pk.column})
			`);
		}
	}
}

async function ensureForeignKeys(client: PoolClient): Promise<void> {
	for (const fk of foreignKeys) {
		const exists = await client.query(
			`SELECT 1
			 FROM information_schema.table_constraints tc
			 JOIN information_schema.key_column_usage kcu
			   ON tc.constraint_name = kcu.constraint_name
			  AND tc.table_schema = kcu.table_schema
			 WHERE tc.table_schema='public'
			   AND tc.constraint_type='FOREIGN KEY'
			   AND tc.table_name=$1
			   AND kcu.column_name=$2
			   AND kcu.ordinal_position=1`,
			[fk.sourceTable, fk.sourceColumn]
		);

		if (exists.rowCount === 0) {
			console.log(`Creating FK: ${fk.sourceTable}.${fk.sourceColumn} -> ${fk.targetTable}.${fk.targetColumn}`);
			await client.query(`
				ALTER TABLE public.${fk.sourceTable}
				ADD CONSTRAINT ${fk.constraintName}
				FOREIGN KEY (${fk.sourceColumn})
				REFERENCES public.${fk.targetTable}(${fk.targetColumn})
				ON DELETE ${fk.onDelete};
			`);
		}
	}
}

// Ensure table_stats has exactly one row
async function ensureStatsRow(client: PoolClient): Promise<void> {
	const tableName = process.env.TABLE_STATS!;
	const res = await client.query(`SELECT COUNT(*) AS cnt FROM public.${tableName}`);
	const count = parseInt(res.rows[0].cnt, 10);

	if (count === 0) {
		console.log(`Inserting initial row into ${tableName}...`);
		await client.query(`
			INSERT INTO public.${tableName} (
				last_beatmapset_id, beatmapset_count, beatmap_count,
				ranked_count, approved_count, loved_count, graveyard_count
			) VALUES (0, 0, 0, 0, 0, 0, 0)
		`);
	} else if (count > 1) {
		console.warn(`Table ${tableName} has more than one row (${count}) — only one row is expected`);
	}
}

async function init(): Promise<void> {
	const pool = new Pool({
		host: process.env.PG_HOSTNAME,
		user: process.env.PG_USERNAME,
		password: process.env.PG_PASSWORD,
	  database: process.env.PG_DATABASE,
	  max: 20,
	  idleTimeoutMillis: 0,
	  connectionTimeoutMillis: 0
	});

	console.log('Testing PostgreSQL connection...');
	try {
		const client = await pool.connect();
		console.log('Successfully connected to PostgreSQL!');
		client.release();
	} catch (err) {
		console.error('Failed to connect to PostgreSQL:', err instanceof Error ? err.message : err);
		process.exit(1);
	}

	// Connect again
	const client = await pool.connect();
	try {
		console.log('Checking PostgreSQL schema consistency...');
		for (const [table, sql] of Object.entries(schema)) {
			const tableNameMatch = (sql as string).match(/CREATE TABLE IF NOT EXISTS public\.([^\s(]+)/i);

			if (!tableNameMatch) continue;
			const tableName = tableNameMatch[1];

			console.log(`Checking table: ${tableName}...`);
			const exists = await tableExists(client, tableName);
			
			if (!exists) {
				console.log(`Creating missing table: ${tableName}`);
				await client.query(sql as string);
				continue;
			}

			console.log(`Get columns for table: ${tableName}...`);
			const currentCols = await getTableColumns(client, tableName);
			const definedCols = extractColumnDefinitions(sql as string);

			for (const [col, def] of Object.entries(definedCols)) {
				if (!currentCols.includes(col)) {
					console.log(`Adding missing column '${col}' to ${tableName}`);
					await client.query(`ALTER TABLE public.${tableName} ADD COLUMN ${def}`);
				}
			}
		}
		await ensurePrimaryKeys(client);
		await ensureForeignKeys(client);
		await ensureStatsRow(client);
		console.log('Database schema is fully up to date!');
	} catch (err) {
		console.error('Schema update failed:', err instanceof Error ? err.message : err);
		throw err;
	} finally {
		client.release();
		await pool.end();
	}
}

export { init };
