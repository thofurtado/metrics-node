import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export interface StorageAdapter {
  save(buffer: Buffer, folder: string, ext: string): Promise<string>;
  delete(relativePath: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.ensureBaseDir();
  }

  private async ensureBaseDir() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (err) {
      console.error('Error creating upload base directory:', err);
    }
  }

  async save(buffer: Buffer, folder: string, ext: string): Promise<string> {
    const filename = `${crypto.randomUUID()}${ext}`;
    const folderPath = path.join(this.baseDir, folder);
    
    await fs.mkdir(folderPath, { recursive: true });
    
    const filePath = path.join(folderPath, filename);
    await fs.writeFile(filePath, buffer);
    
    // Retorna o caminho relativo para salvar no banco
    return `/uploads/${folder}/${filename}`;
  }

  async delete(relativePath: string): Promise<void> {
    // Remove o '/uploads' ou 'uploads' do início para montar o path real
    const strippedPath = relativePath.replace(/^\/?uploads\//, '');
    const fullPath = path.join(this.baseDir, strippedPath);
    
    try {
      await fs.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Error deleting file:', err);
        throw err;
      }
    }
  }
}

export const storage = new LocalStorageAdapter();
