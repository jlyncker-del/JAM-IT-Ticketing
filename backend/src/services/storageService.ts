import { createReadStream, type ReadStream } from "node:fs";
import { readFile, unlink } from "node:fs/promises";

export interface StorageService {
  createReadStream(storagePath: string): ReadStream;
  readText(storagePath: string, maximumBytes: number): Promise<string>;
  delete(storagePath: string): Promise<void>;
}

class LocalStorageService implements StorageService {
  createReadStream(storagePath: string): ReadStream { return createReadStream(storagePath); }
  async readText(storagePath: string, maximumBytes: number): Promise<string> { return (await readFile(storagePath, "utf8")).slice(0, maximumBytes); }
  async delete(storagePath: string): Promise<void> { await unlink(storagePath); }
}

// Ticket services only depend on this interface. An S3-, R2-, MinIO- or Azure-backed
// implementation can replace it without changing ticket authorization or metadata.
export const storageService: StorageService = new LocalStorageService();
