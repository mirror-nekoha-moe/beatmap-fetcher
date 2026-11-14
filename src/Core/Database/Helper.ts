export class DatabaseHelper {
    static toJsonb(value: any): string | null {
        if (value === undefined || value === null) {
            return null;
        }
        const json = JSON.stringify(value);

        // osu! apiv2 format
        return json.replaceAll('.000Z"', 'Z"');
    }
};