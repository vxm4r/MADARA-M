import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Convert Audio to Ogg
 * @param {Buffer} buffer 
 * @param {string[]} args 
 * @param {string} ext 
 * @param {string} ext2 
 * @returns {Promise<Buffer>}
 */
export function toAudio(buffer, ext, ext2) {
    return new Promise((resolve, reject) => {
        try {
            const tmp = path.join(__dirname, '../tmp', + new Date + '.' + ext)
            const out = tmp + '.' + ext2
            fs.writeFileSync(tmp, buffer)
            const ffmpeg = spawn('ffmpeg', [
                '-i', tmp,
                '-vn',
                '-c:a', 'libopus',
                '-b:a', '128k',
                '-vbr', 'on',
                '-compression_level', '10',
                out
            ])
            ffmpeg.on('error', reject)
            ffmpeg.on('close', async (code) => {
                try {
                    await fs.promises.unlink(tmp)
                    if (code !== 0) return reject(code)
                    resolve(await fs.promises.readFile(out))
                    await fs.promises.unlink(out)
                } catch (e) {
                    reject(e)
                }
            })
        } catch (e) {
            reject(e)
        }
    })
}
