/**
 * 核心补丁（原本由 plugins/TRSS-Plugin/index.js 在加载插件时注入）
 *
 * 核心代码直接依赖这些 Bot 方法，但 lib/ 里没有定义：
 *   - Bot.String   lib/plugins/loader.js、plugins/adapter 打日志时用（27 处）
 *   - Bot.sleep    lib/ 里 4 处
 *   - Bot.exec     lib/config/redis.js 启动 Redis 时检测版本
 *   - Bot.fsStat   lib/plugins/loader.js 扫描插件目录
 *   - Bot.download 各插件下载文件
 *
 * 现在改成进程启动时就注入，不再依赖任何插件，删掉 TRSS-Plugin 也能正常跑。
 */
import fs from "node:fs/promises"

if (!Bot.makeForwardArray) {
  const { makeForwardMsg } = (await import("./common/common.js")).default
  Bot.makeForwardArray = msg => makeForwardMsg({}, msg)
}

Bot.sleep ??= (time, promise) => {
  if (promise) return Promise.race([promise, Bot.sleep(time)])
  return new Promise(resolve => setTimeout(resolve, time))
}

Bot.download ??= (await import("./common/common.js")).default.downFile

Bot.String ??= (data, opts) => {
  switch (typeof data) {
    case "string":
      return data
    case "function":
      return String(data)
    case "object":
      if (data instanceof Error) return data.stack
      if (Buffer.isBuffer(data)) return String(data)
  }

  try {
    return JSON.stringify(data, undefined, opts)
  } catch (err) {
    if (typeof data.toString == "function") return String(data)
    else return "[object null]"
  }
}

Bot.Loging ??= Bot.String

if (!Bot.exec) {
  const { exec, execFile } = await import("node:child_process")
  Bot.exec = (cmd, opts = {}) =>
    new Promise(resolve => {
      const name = logger.cyan(Bot.String(cmd))
      logger[opts.quiet ? "debug" : "mark"]("[执行命令]", name)
      opts.encoding ??= "buffer"
      const callback = (error, stdout, stderr) => {
        const raw = { stdout, stderr }
        stdout = String(stdout).trim()
        stderr = String(stderr).trim()
        resolve({ error, stdout, stderr, raw })
        logger[opts.quiet ? "debug" : "mark"](
          `[执行命令] ${name} ${logger.green(`[完成${Date.now() - start_time}ms]`)} ${stdout ? `\n${stdout}` : ""}${stderr ? logger.red(`\n${stderr}`) : ""}`,
        )
        if (error) logger[opts.quiet ? "debug" : "error"]("[执行命令]", error)
      }
      const start_time = Date.now()
      if (Array.isArray(cmd)) execFile(cmd.shift(), cmd, opts, callback)
      else exec(cmd, opts, callback)
    })
}

Bot.fsStat ??= async path => {
  try {
    return await fs.stat(path)
  } catch (err) {
    logger.trace("获取", path, "状态错误", err)
    return false
  }
}

Bot.glob ??= async (path, opts = {}) => {
  if (!opts.force && (await Bot.fsStat(path))) return [path]
  if (!fs.glob) return []
  const array = []
  try {
    for await (const i of fs.glob(path, opts)) array.push(i)
  } catch (err) {
    logger.error("匹配", path, "错误", err)
  }
  return array
}
