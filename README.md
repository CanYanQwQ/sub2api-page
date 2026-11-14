# 岚潮API · 独立首页

参考云智 API 的顶部导航、分组侧栏、宣传与代码窗口布局，为现有 Sub2API 站点制作的独立首页。支持桌面、手机、浅色 / 深色 / 跟随系统。

## 部署关系

```text
用户打开 ai.zhouwanx.top/home
  └─ Sub2API 自定义首页 iframe → cc.zhouwanx.top
       ├─ GET /api/site → Vercel Function
       │    ├─ ai.zhouwanx.top/api/v1/settings/public
       │    └─ ai.zhouwanx.top/api/v1/model-plaza
       └─ 登录、注册、模型广场、控制台等 → ai.zhouwanx.top（顶层跳转）
```

不修改 Sub2API 源码，不重写用户系统，不要求管理员 API Key，不从 iframe 读取父站登录状态。

## 本地启动

需要 Node.js 22.12+（推荐 Node.js 24 LTS）。

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。本地 Vite 已包含与 Vercel Function 相同的 `/api/site` 适配逻辑，不需要额外启动后端。

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run build` 是部署所需的构建命令，输出到 `dist/`。开发验证不要求预先构建。不要直接双击 `index.html`；Vue 与实时数据需要开发服务器或部署平台。

## 部署到 Vercel

1. 将本项目上传到你自己的 Git 仓库，再在 Vercel 中导入。也可以使用 Vercel CLI 部署当前目录。
2. Framework Preset 选择 **Vite**；根目录选本项目目录。
3. Build Command：`npm run build`；Output Directory：`dist`。`vercel.json` 已提供这些配置及 `/api/site` Function。
4. 可选环境变量：`SUB2API_ORIGIN=https://ai.zhouwanx.top`。默认即为这个地址，不需要密钥。
5. 在项目 **Settings → Domains** 绑定 `cc.zhouwanx.top`，按 Vercel 当前提示配置 DNS，等待 HTTPS 证书生效。不要自行猜测 DNS 目标。
6. 打开新域名，确认 Logo、模型目录与官网链接正常。
7. 在 Sub2API **系统设置 → 站点设置 → 首页内容** 中填写：

   ```text
   https://cc.zhouwanx.top/
   ```

   填写 URL 本身即可，不要填 `<iframe>` 代码，也不要把 `cc.zhouwanx.top` 设置为模型 API 端点。
8. 保存后，在浏览器新开 `https://ai.zhouwanx.top/home` 验证嵌入和顶层跳转。可回到后台清空“首页内容”恢复官方首页。

Vercel 的 Node 运行时请使用受支持的 LTS 版本（推荐 Node.js 24）。本项目没有数据库、付费 API 或后台密钥配置。

### iframe 安全配置

`vercel.json` 已配置：

```http
Content-Security-Policy: ...; frame-ancestors 'self' https://ai.zhouwanx.top; ...
```

只允许自身和 `ai.zhouwanx.top` 嵌入。不配置 `X-Frame-Options: SAMEORIGIN` 或 `DENY`，它们会阻止跨域首页嵌入；也不要使用已废弃的 `ALLOW-FROM`。

**两侧策略必须都允许：**
- 子页 `cc.zhouwanx.top` 的 `frame-ancestors` 允许父站。
- 父站 `ai.zhouwanx.top` 的 CSP `frame-src` 允许 `https://cc.zhouwanx.top`。Sub2API 0.2.21 有动态嵌入域名处理；如果你的反向代理/CDN另加了一份 CSP，需要在那份既有策略的 `frame-src` 中加入新域名，而不是关闭整个 CSP。
- 如额外启用 Vercel Deployment Protection、Cloudflare 访问验证等，正式首页必须对普通访客开放，否则 iframe 里可能出现验证页。

**允许 iframe ≠ 允许 CORS。** 本项目的公开 API 请求由 Vercel Function 发出，浏览器只请求同源 `/api/site`，正常部署无需放开 Sub2API CORS。不要把 CORS 改成 `*` 当作 iframe 修复方案。

### 如何避免跳转后 iframe 套娃

官方功能链接使用绝对地址和 `target="_top"`，点击后从 iframe 退出，在整个标签页打开原站。登录状态仍由原站处理；不把登录、支付页面再嵌入 iframe，也不转发 Token。

如果你自己额外增加了 iframe `sandbox`，顶层导航可能被限制；应按实际安全要求允许**用户手势触发**的顶层导航，或将官方入口改为新标签页。Sub2API 0.2.21 默认首页 iframe 未设置 sandbox。

## 数据来源与更新

已核对 **Sub2API v0.2.21** 官方源码及正在运行的站点公开接口。

| 页面内容 | 来源 / 行为 |
| --- | --- |
| 站名、Logo | `/api/v1/settings/public`，加载成功后使用实时信息；页面不展示技术署名及版本号 |
| 开放功能入口 | 同一接口的注册、模型广场、支付、订阅、监控等开关；确认关闭后隐藏对应入口 |
| API 地址 | `api_base_url`，为空时使用原站根地址；OpenAI SDK 自动加一次 `/v1` |
| 模型名称、厂家、去重数量、分组数 | `/api/v1/model-plaza` 的匿名公开数据，不带用户专属分组信息 |
| 模型价格 | 不在首页自行计算；跳转官方模型广场查看完整分组、倍率、阶梯与时段规则 |
| 文档、联系方式 | 有真实配置才使用；未配置文档时使用本页接入指南 |
| 公告 | 官方公告接口需要认证；首页说明弹窗由用户主动打开，再引导去控制台查看 |
| 用户余额、登录状态、私有日志 | 不在公开首页获取或缓存；均在官方控制台处理 |

Vercel 缓存成功的公开信息 60 秒。无用户认证缓存、无浏览器 Cookie/Authorization 转发、无任意 URL 代理。接口失败有重试入口，名称/Logo/端点可回退到已核实的品牌信息；不内置虚假模型数量或价格。单个模型可能随站点配置变化，公开目录收录不代表服务可用率或每个账户的权限。

由于官方首页 iframe 不自动透传用户主题，首页有自己的主题设置，不会读取父站 DOM；主题选择在当前域名保存。浏览器禁止本地存储时也能正常使用，只是不记住偏好。复制功能有 iframe 权限降级和手动复制入口，不自动发出任何计费模型请求。

## 配置与文件

```text
src/App.vue                 页面与交互
src/style.css               响应式页面样式
src/tokens.css              颜色、字体等变量
src/config.ts               官网路由、品牌回退、模型类别展示文案
src/snippets.ts             可复制的 Node.js / Python / cURL 代码
src/useSite.ts              公开数据读取与降级
server/site.js              白名单公开接口读取、字段清洗与目录汇总
api/site.js                 Vercel Function
vercel.json                 部署与安全响应头
public/brand.webp           现有品牌 Logo 回退
public/ASSETS.md             素材来源
deploy/nginx.conf.example   自建服务器备选
scripts/verify-public.mjs    非计费的公开接口/路由/安全配置轻量检查
scripts/verify-ui.mjs        隔离浏览器轻量交互检查（需要 Chrome / Edge）
```

换域名时需要**同时**检查 `SUB2API_ORIGIN`、`src/config.ts` 回退地址、`vercel.json` 的 `frame-ancestors` / `img-src`，不要只改一个链接。修改配色可编辑 `src/tokens.css`。现有 Logo 是品牌资产，不是新增表情或装饰。

配色参考 Claude：暖米白底、炭灰正文、陶土橙强调色；深色模式为暖炭灰与浅陶土。参考的是色彩关系，不使用 Claude 品牌标识或声称得到其授权。全站不使用渐变色。

### 已完成的验证与边界

- `npm run typecheck`、`npm run lint` 已通过。
- `node scripts/verify-public.mjs`：11 项轻量检查通过，包含真实公开数据、字段清洗、关闭/受限/失败状态和 iframe 白名单配置。
- 开发服务运行时执行 `node scripts/verify-ui.mjs`：检查侧栏连续收展、内容同步扩宽、快速反向操作、减少动态效果、状态刷新读回，以及代码切换/展开、复制、搜索、错误恢复等交互，最新结果见本地验证记录。
- 1440 × 900、390 × 844 深浅模式截图已检查，无根级横向溢出、控制台报错或损坏图片。200%使用等效 CSS 视口及像素倍率检查重排，未冒称已操作浏览器菜单缩放。
- **尚未部署到 Vercel，也未修改你的 Sub2API 设置。** 正式域名 iframe 需要部署后联验。本地跨源 iframe 尝试被 Chromium Local Network Access 策略阻止，未关闭浏览器安全限制。
- 未发出付费模型调用，未登录或操作用户账户；不把模板代码当作真实请求成功证明。
- 本轮没有运行生产构建或全量测试。生产构建由部署平台按上面的命令运行。
- 运行时依赖审计为 0 项漏洞；完整开发依赖审计有 9 项 moderate 提示，来自类型检查/lint工具的 `minimatch` 依赖链，未进行强制大版本升级。

UI 截图、设计记录和评审材料在本地 `.oil-ui/lanchao-home/`，不属于部署产物，正式页面不引用这个目录。

## 自建服务器备选

如果 Vercel 无法连接你的源站，可在自己的服务器部署。将 `npm run build` 产生的 `dist/` 放到站点目录，参考 `deploy/nginx.conf.example`：静态页由 Nginx 提供，`/api/site` 由 `server/standalone.js` 的只读适配服务提供。

```bash
SUB2API_ORIGIN=https://ai.zhouwanx.top PORT=8787 node server/standalone.js
```

上面是 Linux 环境变量写法。实际运维建议使用你现有的 systemd/进程管理器并绑定回环地址，不要将适配服务直接暴露公网。不要使用 `vite dev` 作为生产服务器。

## 官方资料

- [Sub2API 中文说明](https://github.com/Wei-Shaw/sub2api/blob/v0.2.21/README_CN.md)
- [0.2.21 首页 iframe 实现](https://github.com/Wei-Shaw/sub2api/blob/v0.2.21/frontend/src/views/HomeView.vue)
- [官方页面路由](https://github.com/Wei-Shaw/sub2api/blob/v0.2.21/frontend/src/router/index.ts)
- [公开模型广场接口与数据语义](https://github.com/Wei-Shaw/sub2api/blob/v0.2.21/frontend/src/api/modelPlaza.ts)
- [购买页/菜单页参数透传文档](https://github.com/Wei-Shaw/sub2api/blob/v0.2.21/docs/ADMIN_PAYMENT_INTEGRATION_API.md)（与首页 iframe 不同，首页不依赖其中的 Token 透传）
