import { readFile, unlink } from "node:fs/promises";

export interface StorageService {
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

// Read-only fallback for attachment records created before database-backed
// storage was introduced. New uploads are persisted directly by AttachmentService.
class LegacyLocalStorageService implements StorageService {
  async read(storagePath: string): Promise<Buffer> { return readFile(storagePath); }
  async delete(storagePath: string): Promise<void> { await unlink(storagePath); }
}

// Ticket services only depend on this interface. An S3-, R2-, MinIO- or Azure-backed
// implementation can replace it without changing ticket authorization or metadata.
export const storageService: StorageService = new LegacyLocalStorageService();
