import { ensureDir } from "https://deno.land/std@0.204.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.204.0/path/mod.ts";
import { dbSqLiteHandler } from "../classes/db-sqlite.ts";

const BACKUP_DIR = "./data/backups";
const MAX_BACKUPS = 5;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class BackupService {
  private timerId: number | null = null;

  async start() {
    await ensureDir(BACKUP_DIR);
    this.scheduleBackup();
  }

  private scheduleBackup() {
    this.timerId = setInterval(() => {
      this.backupDatabase().catch(console.error);
    }, BACKUP_INTERVAL_MS);
    // Run immediately on start
    this.backupDatabase().catch(console.error);
  }

  async backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = join(BACKUP_DIR, `backup-${timestamp}.sqlite`);

    // Use VACUUM INTO for a safe backup
    try {
      // Ensure DB is initialized
      if (!dbSqLiteHandler.db) {
        await dbSqLiteHandler.initialize();
      }
      await dbSqLiteHandler.db!.exec(`VACUUM INTO '${backupFile}'`);
      console.log(`[BackupService] Database safely backed up to ${backupFile}`);
    } catch (err) {
      console.error(`[BackupService] Failed to backup database:`, err);
      return;
    }

    await this.cleanupOldBackups();
  }

  async cleanupOldBackups() {
    const files: string[] = [];
    for await (const entry of Deno.readDir(BACKUP_DIR)) {
      if (entry.isFile && entry.name.endsWith(".sqlite")) {
        files.push(entry.name);
      }
    }
    if (files.length > MAX_BACKUPS) {
      files.sort(); // ISO timestamp in filename sorts oldest first
      const toDelete = files.slice(0, files.length - MAX_BACKUPS);
      for (const file of toDelete) {
        await Deno.remove(join(BACKUP_DIR, file));
        console.log(`[BackupService] Deleted old backup: ${file}`);
      }
    }
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
