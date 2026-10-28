# TRSS-Lite

TRSS-Yunzai 的**精简版**：只保留核心框架和两个常用小插件，适合轻量部署和二次开发。

> 上游项目：[TRSS-Yunzai](https://git.trss.me/Yunzai)（GPL-3.0）
> 本仓库是裁剪后的衍生版本，保留上游许可证，详见 [LICENSE](./LICENSE)。

## 保留了什么

| 模块 | 说明 |
|---|---|
| `lib/` | 核心框架（插件加载、事件、配置、渲染、Redis） |
| `plugins/adapter/OneBotv11.js` | OneBot v11 适配器（NapCat / LLOneBot 等） |
| `plugins/example/只听我的.js` | 按群控制 Bot 是否只回应主人，可加授权用户 |
| `plugins/example/进群退群通知.js` | 新人入群欢迎、退群提示 |

## 删掉了什么

- 所有业务插件（原版 `plugins/` 下的示例与生态插件）
- 托管平台适配器（只留 OneBot v11）
- 与业务相关的配置、素材、数据目录

## 环境要求

- Node.js ≥ 20（推荐 22 LTS）
- Redis（推荐，未连接时部分功能会降级）
- pnpm ≥ 9

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 首次启动（会自动生成 config/config）
node app.js

# 3. 修改配置
#    config/config/bot.yaml    —— 机器人 QQ
#    config/config/other.yaml  —— 主人 QQ
#    config/config/server.yaml —— 监听端口（默认 2536，和私有版一致）
#    config/config/redis.yaml  —— Redis 地址

# 4. 启动
node app.js
```

Windows 也可以直接双击 `start.cmd`。

然后用 NapCat / LLOneBot 连接：

```
ws://127.0.0.1:2536/OneBotv11
```

## 指令

| 指令 | 权限 | 说明 |
|---|---|---|
| `#只听我的` | 主人 | 本群只回应主人和授权用户 |
| `#听大家的` | 主人 | 恢复回应所有人 |
| `#互动添加 QQ号/@某人` | 主人 | 加一个授权用户 |
| `#互动删除 QQ号/@某人` | 主人 | 移除授权用户 |
| `#互动列表` / `#授权列表` | 主人 | 查看本群授权用户 |
| `#屏蔽列表` | 主人 | 查看所有开启「只听我的」的群 |
| `#重启` | 主人 | 退出进程，由 `启动.cmd` 重新拉起（约 5 秒） |
| `#重载` | 主人 | 不退出进程，重新加载插件（约 0.4 秒） |

`#重载` 只重新 import `plugins/` 下的插件文件，改 `lib/` 或安装依赖仍需 `#重启`。
`#重启` 依赖 `启动.cmd` 的托管循环（`FM_SUPERVISED=1` + 退出码 255）；直接 `node app.js` 运行时它只会退出。

「只听我的」的配置保存在 `data/only-listen-to-me.json`，格式：

```json
{
  "群号": { "sleep": true, "allowUsers": ["QQ号"] }
}
```

## 注意

TRSS 启动时会先请求 `http://localhost:<port>/exit` 关闭同端口的旧实例。
**如果本机已经有一个 bot 在跑**，请先把 `config/config/server.yaml` 的 `port` 改成别的（例如 2537），
再启动本项目，否则会把原来的 bot 关掉。

## 写自己的插件

放到 `plugins/<插件名>/index.js`：

```js
import plugin from '../../lib/plugins/plugin.js'

export class MyPlugin extends plugin {
  constructor() {
    super({
      name: '示例插件',
      dsc: '收到 #ping 回 pong',
      event: 'message',
      rule: [{ reg: '^#ping$', fnc: 'ping' }],
    })
  }

  async ping(e) {
    await e.reply('pong')
  }
}
```

## 与上游的差异

- 只保留 OneBot v11 适配器
- 只保留两个示例插件，其余全部移除
- 依赖精简：只装运行需要的包（`pnpm install` 会自动按 `package.json` 安装）
- 配置与数据目录不随仓库分发，首次启动自动生成

## 许可证

GPL-3.0，与上游一致。修改和分发请保留 [LICENSE](./LICENSE) 与来源说明。
