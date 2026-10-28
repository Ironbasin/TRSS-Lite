import plugin from '../../lib/plugins/plugin.js'
import { segment } from 'icqq'

/**
 * 进群欢迎 / 退群通知
 *
 * 欢迎：同一个群 30 秒内只发一次，避免刷屏
 * 退群：优先用群名片，没有就退回 QQ 号
 */

const WELCOME_CD_SECONDS = 30
const WELCOME_TEXT = ' 欢迎新人，记得看群公告~'

export class GroupWelcome extends plugin {
  constructor() {
    super({
      name: '进群欢迎',
      dsc: '新人入群时欢迎',
      event: 'notice.group.increase',
    })
  }

  async accept(e) {
    const event = e || this.e
    if (!event?.group_id) return
    if (String(event.user_id) === String(event.self_id)) return

    const key = `Yz:newcomers:${event.group_id}`
    if (await redis.get(key)) return
    await redis.set(key, '1', { EX: WELCOME_CD_SECONDS })

    await event.reply([segment.at(event.user_id), WELCOME_TEXT])
  }
}

export class GroupLeaveNotice extends plugin {
  constructor() {
    super({
      name: '退群通知',
      dsc: '有人退群时提示',
      event: 'notice.group.decrease',
    })
  }

  async accept(e) {
    const event = e || this.e
    if (!event?.group_id) return
    if (String(event.user_id) === String(event.self_id)) return

    const name = event.member?.card || event.member?.nickname || ''
    const who = name ? `${name}(${event.user_id})` : String(event.user_id)
    const message = `${who} 退群了`

    logger.mark(`[退群通知]${event.logText || ''} ${message}`)
    await event.reply(message)
  }
}
