import fs from 'fs/promises'
import fscore from 'fs'
import path from 'path'
import { StorageTypeConfig } from './Storage'
import { ImageUploadTask, StorageProvider } from './StorageProvider'

export interface LocalConfig extends StorageTypeConfig {
    driver: 'local'
}

export class LocalStorageProvider implements StorageProvider {

    path(filename: string) {
        return path.join(process.cwd(), 'public', 'uploads', filename)
    }

    async upload(task: ImageUploadTask) {
        const filepath = task.url
        const dir = path.dirname(filepath)
        await fs.mkdir(dir, { recursive: true })
        await new Promise<void>((resolve, reject) => {
            const out = fscore.createWriteStream(filepath)
            task.stream.pipe(out)
            out.on('finish', () => resolve())
            out.on('error', reject)
        })
    }

    async delete(filename: string): Promise<void> {
        await fs.unlink(filename)
    }
}
