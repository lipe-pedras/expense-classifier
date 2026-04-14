import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DocumentUploadFailedError } from '../errors/AppError.js';

export interface FileSystemAdapter {
  writeFile(filePath: string, data: Buffer): Promise<void>;
  mkdir(dirPath: string, options: { recursive: boolean }): Promise<void>;
  unlink(filePath: string): Promise<void>;
}

export class StorageService {
  constructor(
    private readonly uploadPath: string,
    private readonly fs: FileSystemAdapter,
  ) {}

  async saveUploadedFile(buffer: Buffer, originalName: string): Promise<string> {
    try {
      await this.fs.mkdir(this.uploadPath, { recursive: true });
      const ext = path.extname(originalName);
      const filename = `${randomUUID()}${ext}`;
      const filePath = path.join(this.uploadPath, filename);
      await this.fs.writeFile(filePath, buffer);
      return filePath;
    } catch {
      throw new DocumentUploadFailedError();
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await this.fs.unlink(filePath);
    } catch {
      // Best-effort — file may already be gone. Do not fail the caller.
    }
  }
}
