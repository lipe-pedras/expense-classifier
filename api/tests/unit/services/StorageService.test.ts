import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import { StorageService, type FileSystemAdapter } from '../../../src/services/StorageService.js';
import { DocumentUploadFailedError } from '../../../src/errors/AppError.js';

function makeFs(): FileSystemAdapter {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
}

describe('StorageService', () => {
  let fs: FileSystemAdapter;
  let service: StorageService;

  beforeEach(() => {
    fs = makeFs();
    service = new StorageService('/uploads', fs);
  });

  describe('saveUploadedFile', () => {
    it('should create the upload directory and write the buffer', async () => {
      const buffer = Buffer.from('hello');
      const filePath = await service.saveUploadedFile(buffer, 'bill.pdf');

      expect(fs.mkdir).toHaveBeenCalledWith('/uploads', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      const [writtenPath, writtenBuffer] = (fs.writeFile as any).mock.calls[0];
      expect(writtenBuffer).toBe(buffer);
      expect(path.dirname(writtenPath)).toBe('/uploads');
      expect(path.extname(writtenPath)).toBe('.pdf');
      expect(filePath).toBe(writtenPath);
    });

    it('should generate unique filenames for repeat uploads', async () => {
      const a = await service.saveUploadedFile(Buffer.from('x'), 'bill.pdf');
      const b = await service.saveUploadedFile(Buffer.from('x'), 'bill.pdf');
      expect(a).not.toBe(b);
    });

    it('should preserve the extension of the original file', async () => {
      const filePath = await service.saveUploadedFile(Buffer.from('x'), 'receipt.PNG');
      expect(path.extname(filePath)).toBe('.PNG');
    });

    it('should throw DocumentUploadFailedError when the filesystem fails', async () => {
      (fs.writeFile as any).mockRejectedValue(new Error('disk full'));
      await expect(
        service.saveUploadedFile(Buffer.from('x'), 'bill.pdf'),
      ).rejects.toBeInstanceOf(DocumentUploadFailedError);
    });
  });

  describe('deleteFile', () => {
    it('should unlink the given path', async () => {
      await service.deleteFile('/uploads/a.pdf');
      expect(fs.unlink).toHaveBeenCalledWith('/uploads/a.pdf');
    });

    it('should swallow filesystem errors (best-effort)', async () => {
      (fs.unlink as any).mockRejectedValue(new Error('gone'));
      await expect(service.deleteFile('/uploads/a.pdf')).resolves.toBeUndefined();
    });
  });
});
