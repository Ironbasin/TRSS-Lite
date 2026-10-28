import fs from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const LEGACY_ERROR_LOG_LIMIT = 10 * 1024 * 1024

async function removeOldFiles(dir, cutoff) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const target = path.join(dir, entry.name)
    try {
      if (entry.isDirectory()) {
        await removeOldFiles(target, cutoff)
        continue
      }
      if (!entry.isFile()) continue
      const stat = await fs.stat(target)
      if (stat.mtimeMs < cutoff) await fs.unlink(target)
    } catch {
      // 文件可能正在被占用，跳过即可
    }
  }
}

async function removeOldDirs(dir, cutoff) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const target = path.join(dir, entry.name)
    try {
      const stat = await fs.stat(target)
      if (stat.mtimeMs < cutoff) {
        await fs.rm(target, { recursive: true, force: true })
      }
    } catch {
      // 目录可能正在被浏览器占用，跳过即可
    }
  }
}

async function archiveLegacyErrorLog() {
  const file = path.join(ROOT, "logs", "error.log")
  try {
    const stat = await fs.stat(file)
    if (stat.size < LEGACY_ERROR_LOG_LIMIT) return

    const archiveDir = path.join(ROOT, "logs", "archive")
    await fs.mkdir(archiveDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const target = path.join(archiveDir, `error.legacy-${stamp}.log`)
    await fs.rename(file, target)
    console.log(`[Cleanup] 已归档旧 error.log: ${target}`)
  } catch {
    // error.log 不存在或被占用时忽略
  }
}

export async function cleanupTempFiles() {
  const cutoff = Date.now() - MAX_AGE
  await Promise.all([
    removeOldFiles(path.join(ROOT, "data", "temp"), cutoff),
    removeOldFiles(path.join(ROOT, "temp", "html"), cutoff),
    removeOldDirs(path.join(ROOT, "temp", "puppeteer"), cutoff),
    archiveLegacyErrorLog(),
  ])
}

export function startCleanupJob() {
  const timer = setInterval(
    () => {
      cleanupTempFiles().catch(() => {})
    },
    24 * 60 * 60 * 1000,
  )
  timer.unref?.()
  return timer
}
