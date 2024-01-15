// for migrations
import { migrateDatabase } from "../connections";

try {
    await migrateDatabase();
} catch (e) {
    console.error(e);
    process.exit(1);
}

process.exit(0);

