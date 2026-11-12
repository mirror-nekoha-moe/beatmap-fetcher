export class DatabaseHelper {
    static toJsonb(value: any): string | null {
        if (value === undefined || value === null) {
            return null;
        }
        return JSON.stringify(value);
    }
};