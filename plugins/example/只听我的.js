import fs from 'node:fs'
import path from 'node:path'
import plugin from '../../lib/plugins/plugin.js'

/**
 * 只听我的：按群控制 Bot 是否只回应主人
 *
 * 设计要点：
 * - 配置读一次放内存，只有改动才落盘（500ms 防抖），accept 不走磁盘
 * - 每个群的配置独立初始化，避免多个群共用同一个默认对象
 * - accept 返回 true 时，loader 会停止后续插件处理，等于"屏蔽非授权成员"
 */

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'only-listen-to-me.json')

const DEFAULT_GROUP_STATE = () => ({ sleep: false, allowUsers: [] })

let state = null
let writeTimer = null

function loadState() {
  if (state) return state
  state = {}
  try {
    if (!fs.existsSync(DATA_FILE)) return state
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed
  } catch (err) {
    logger.error(`[只听我的] 读取配置失败：${err.message || err}`)
  }
  return state
}

function groupState(groupId) {
  const all = loadState()
  const key = String(groupId)
  if (!all[key] || typeof all[key] !== 'object') all[key] = DEFAULT_GROUP_STATE()
  if (!Array.isArray(all[key].allowUsers)) all[key].allowUsers = []
  return all[key]
}

function saveState() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(DATA_FILE, JSON.stringify(loadState(), null, 2))
    } catch (err) {
      logger.error(`[只听我的] 保存配置失败：${err.message || err}`)
    }
  }, 500)
  writeTimer.unref?.()
}

function parseTarget(e) {
  if (e?.at) return String(e.at)
  const match = String(e?.msg || '').match(/(\d{5,})/)
  return match ? match[1] : ''
}

export class OnlyListenToMe extends plugin {
  constructor() {
    super({
      name: '只听我的',
      dsc: '按群控制 Bot 是否只回应主人，可加授权用户',
      event: 'message',
      priority: -99999999999,
      rule: [
        { reg: '^#?只听我的$', fnc: 'enableOwnerOnly' },
        { reg: '^#?听大家的$', fnc: 'disableOwnerOnly' },
        { reg: '^#?(屏蔽群列表|屏蔽列表)$', fnc: 'listMutedGroups' },
        { reg: '^#?互动添加(?:\\s+|\\s*[:：]\\s*)(.+)$', fnc: 'addUser' },
        { reg: '^#?互动删除(?:\\s+|\\s*[:：]\\s*)(.+)$', fnc: 'delUser' },
        { reg: '^#?(互动列表|授权列表)$', fnc: 'listAllowedUsers' },
      ],
    })
  }

  /** 每条消息都会走这里：判断要不要把非授权成员的消息吞掉 */
  async accept(e) {
    const event = e || this.e
    if (!event) return false
    if (event.isMaster) return false
    if (!event.isGroup) return false

    const current = groupState(event.group_id)
    if (current.allowUsers.includes(String(event.user_id))) return false
    return Boolean(current.sleep)
  }

  requireMaster(e) {
    if (e.isMaster) return true
    e.reply('只有主人能改这个设置')
    return false
  }

  async enableOwnerOnly(e) {
    if (!this.requireMaster(e)) return true
    const current = groupState(e.group_id)
    if (current.sleep) {
      await e.reply('本群已经是「只听我的」了')
      return true
    }
    current.sleep = true
    saveState()
    await e.reply('已开启：本群只回应主人（授权用户除外）')
    return true
  }

  async disableOwnerOnly(e) {
    if (!this.requireMaster(e)) return true
    const current = groupState(e.group_id)
    if (!current.sleep) {
      await e.reply('本群现在是「听大家的」')
      return true
    }
    current.sleep = false
    saveState()
    await e.reply('已关闭：本群正常回应所有人')
    return true
  }

  async listMutedGroups(e) {
    if (!this.requireMaster(e)) return true
    const all = loadState()
    const muted = Object.keys(all).filter(id => all[id]?.sleep)
    if (!muted.length) {
      await e.reply('当前没有开启「只听我的」的群')
      return true
    }
    await e.reply(`开启「只听我的」的群：\n${muted.join('\n')}`)
    return true
  }

  async addUser(e) {
    if (!this.requireMaster(e)) return true
    if (!e.isGroup) {
      await e.reply('请在群里使用这条指令')
      return true
    }
    const target = parseTarget(e)
    if (!target) {
      await e.reply('格式：#互动添加 QQ号 或 #互动添加 @某人')
      return true
    }

    const current = groupState(e.group_id)
    if (current.allowUsers.includes(target)) {
      await e.reply(`${target} 已经在授权列表里`)
      return true
    }
    current.allowUsers.push(target)
    saveState()
    await e.reply(`已添加授权用户：${target}`)
    return true
  }

  async delUser(e) {
    if (!this.requireMaster(e)) return true
    if (!e.isGroup) {
      await e.reply('请在群里使用这条指令')
      return true
    }
    const target = parseTarget(e)
    if (!target) {
      await e.reply('格式：#互动删除 QQ号 或 #互动删除 @某人')
      return true
    }

    const current = groupState(e.group_id)
    const index = current.allowUsers.indexOf(target)
    if (index === -1) {
      await e.reply(`${target} 不在授权列表里`)
      return true
    }
    current.allowUsers.splice(index, 1)
    saveState()
    await e.reply(`已移除授权用户：${target}`)
    return true
  }

  async listAllowedUsers(e) {
    if (!this.requireMaster(e)) return true
    if (!e.isGroup) {
      await e.reply('请在群里使用这条指令')
      return true
    }
    const current = groupState(e.group_id)
    if (!current.allowUsers.length) {
      await e.reply('本群还没有授权用户')
      return true
    }
    await e.reply(`本群授权用户：\n${current.allowUsers.join('\n')}`)
    return true
  }
}
