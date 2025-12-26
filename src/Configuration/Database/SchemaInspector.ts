import { PoolClient } from 'pg';

export class SchemaInspector {
  static async tableExists(client: PoolClient, tableName: string): Promise<boolean> {
    const res = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )`,
      [tableName]
    );
    return res.rows[0].exists;
  }
  
  static async getTableColumns(client: PoolClient, tableName: string): Promise<string[]> {
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName]
    );
    return res.rows.map((r: { column_name: string }) => r.column_name);
  }
  
  static extractColumnDefinitions(schemaSQL: string): Record<string, string> {
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
}