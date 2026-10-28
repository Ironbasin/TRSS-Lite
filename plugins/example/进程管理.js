import fs from 'node:fs'
import path from 'node:path'
import plugin from '../../lib/plugins/plugin.js'
import PluginsLoader from '../../lib/plugins/loader.js'

/**
 * 进程管理：#重启 / #重载
 *
 * #重启：进程退出（255），由启动器（启动.cmd）重新拉起。
 * #重载：不退出进程，重新 import 插件文件，替换事件处理实例。
 *       适合改了插件代码不想等重启；改 lib/ 或装依赖仍需 #重启。
 */

const SELF_KEY = 'example/进程管理.js'

function listPluginKeys() {
  const root = path.join(process.cwd(), 'plugins')
  const keys = []
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const dirPath = path.join(root, dir.name)
    if (fs.existsSync(path.join(dirPath, 'index.js'))) {
      keys.push(`${dir.name}/index.js`)
      continue
    }
    for (const file of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.js')) continue
      keys.push(`${dir.name}/${file.name}`)
    }
  }
  return keys
}

export class ProcessControl extends plugin {
  constructor() {
    super({
      name: '进程管理',
      dsc: '#重启 #重载',
      event: 'message',
      priority: -Infinity,
      rule: [
        { reg: '^#重启$', fnc: 'restart', permission: 'master' },
        { reg: '^#重载$', fnc: 'reload', permission: 'master' },
      ],
    })
  }

  async restart() {
    await this.reply('开始重启…')
    const ret = await Bot.restart()
    await this.reply(`重启失败\n${Bot.String(ret)}`)
    return true
  }

  async reload() {
    const startedAt = Date.now()
    let done = 0
    const failed = []
    for (const key of listPluginKeys()) {
      if (key === SELF_KEY) continue
      try {
        await PluginsLoader.changePlugin(key)
        done++
      } catch (err) {
        failed.push(`${key}: ${err.message}`)
      }
    }
    const tail = failed.length ? `\n失败 ${failed.length} 个：\n${failed.join('\n')}` : ''
    const cost = ((Date.now() - startedAt) / 1000).toFixed(2)
    await this.reply(`重载完成，用时 ${cost}s（${done} 个插件）${tail}`)
    return true
  }
}
