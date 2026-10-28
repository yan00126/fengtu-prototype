# 枫途 · 低保真原型

把 PR 之路变成成长记录的测试原型。

- 纯静态网页，没有构建步骤，没有服务器端
- 数据只存在使用者自己的浏览器（localStorage）里，可以在“我的”页面导出 / 导入
- 界面全中文，按手机屏幕设计

## 本地运行

```bash
python3 -m http.server 5173
```

然后打开 http://localhost:5173 。（ES 模块不能直接用 `file://` 打开。）

## 测试

```bash
npm test
```

只测纯逻辑：CRS 规则（`js/rules.js`）和 XP、连续打卡、熟练度（`js/xp.js`）。

## 文件

| 文件 | 内容 |
|---|---|
| `js/rules.js` | CRS 规则和考试成绩换算（规则版本 2026-11-03，含 LMI 新规则） |
| `js/content.js` | XP 参数、法语小等级、can-do 成就等可调的内容 |
| `js/xp.js` | XP、每日递减、连续打卡和冻结卡、熟练度估算与校准、成就 |
| `js/store.js` | 本地存储、导出 / 导入 |
| `js/card.js` | 分享卡片（canvas 生成图片） |
| `js/app.js` | 页面和交互 |

要调 XP 数字、小等级小时数、can-do 成就，改 `js/content.js` 就行。

## 发布给测试者

任何静态网站托管都可以，例如 GitHub Pages、Cloudflare Pages、Netlify：把 `prototype/` 整个文件夹上传即可。测试者用手机打开链接，可以“添加到主屏幕”。

提醒测试者：
- 清除浏览器数据会丢失记录，请定期导出备份
- 在微信内置浏览器里打开时，数据和系统浏览器里的不是同一份，建议固定用一个浏览器
