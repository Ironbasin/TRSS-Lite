/**
 * plugin 的 runtime，可通过 e.runtime 访问
 *
 * 提供一些常用的运行时变量、方法和 model 获取，降低插件对目录结构的依赖。
 * 这里只保留与具体游戏/插件无关的通用能力：
 * 原版里原神（genshin）和 miao-plugin 的绑定已经移除。
 */
import lodash from "lodash"
import fs from "node:fs/promises"
import common from "../common/common.js"
import cfg from "../config/config.js"
import puppeteer from "../puppeteer/puppeteer.js"
import Handler from "./handler.js"

export default class Runtime {
  constructor(e) {
    this.e = e
    this.handler = {
      has: Handler.has,
      call: Handler.call,
      callAll: Handler.callAll,
    }
  }

  get user() {
    return this.e.user
  }

  get uid() {
    return this.user?.uid
  }

  get hasCk() {
    return this.user?.hasCk
  }

  get cfg() {
    return cfg
  }

  get common() {
    return common
  }

  get puppeteer() {
    return puppeteer
  }

  /**
   * 渲染插件模板并截图发送
   *
   * @param plugin plugin key
   * @param path html 文件路径，相对于 plugin resources 目录
   * @param data 渲染数据
   * @param renderCfg 渲染配置
   * @param renderCfg.retType 返回值类型：default 自动发送 / msgId 返回消息 id / base64 返回图片
   * @param renderCfg.beforeRender({data}) 可改写渲染数据
   */
  async render(plugin, path, data = {}, renderCfg = {}) {
    path = path.replace(/.html$/, "")
    const paths = lodash.filter(path.split("/"), p => !!p)
    path = paths.join("/")

    await Bot.mkdir(`temp/html/${plugin}/${path}`)

    const pluResPath = `../../../${lodash.repeat("../", paths.length)}plugins/${plugin}/resources/`
    const layoutPath = `${process.cwd()}/plugins/miao-plugin/resources/common/layout/`

    data = {
      sys: { scale: 1 },
      copyright: "Created By TRSS-Yunzai",
      _res_path: pluResPath,
      _miao_path: `../../../${lodash.repeat("../", paths.length)}plugins/miao-plugin/resources/`,
      _tpl_path: `${process.cwd()}/plugins/miao-plugin/resources/common/tpl/`,
      defaultLayout: `${layoutPath}default.html`,
      elemLayout: `${layoutPath}elem.html`,
      ...data,
      _plugin: plugin,
      _htmlPath: path,
      pluResPath,
      tplFile: `./plugins/${plugin}/resources/${path}.html`,
      saveId: data.saveId || data.save_id || paths[paths.length - 1],
    }

    if (renderCfg.beforeRender) data = renderCfg.beforeRender({ data }) || data

    if (process.argv.includes("dev")) {
      const saveDir = `temp/ViewData/${plugin}`
      await Bot.mkdir(saveDir)
      const file = `${saveDir}/${data._htmlPath.split("/").join("_")}.json`
      await fs.writeFile(file, JSON.stringify(data))
    }

    const base64 = await puppeteer.screenshot(`${plugin}/${path}`, data)
    if (renderCfg.retType === "base64") return base64

    let ret = true
    if (base64) {
      if (renderCfg.recallMsg) ret = await this.e.reply(base64, false, {})
      else ret = await this.e.reply(base64)
    }
    return renderCfg.retType === "msgId" ? ret : true
  }

  static async init(e) {
    e.runtime = new Runtime(e)
    return e.runtime
  }
}
