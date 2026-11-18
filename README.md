# 游戏宝箱（中文版）

西班牙语原站 https://el.bauldejuegos.workers.dev/ 的中文改编版，纯静态，无需构建。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 页面结构（英雄区、句子式筛选、工具栏、更多筛选、结果、说明、添加/编辑/历史/复制对话框） |
| `style.css` | 样式 |
| `app.js` | 筛选、排序、搜索、收藏、评分、添加/编辑/删除、历史记录与恢复、复制规则 |
| `games.js` | 90 个游戏的中文数据（`window.SEED_GAMES`），由 `games.json` 生成 |
| `games.json` | 同上，便于阅读和编辑 |
| `_screenshots/` | 无头 Chrome 的验证截图 |

## 与原站的差别

- 原站把改动存在服务器上，所有人实时可见；本版没有后端，用户的添加、修改、删除、收藏和评分存在浏览器 `localStorage`，只在本机可见。要做成多人共享，需要接一个后端（例如 Cloudflare Workers + KV，和原站一样）。
- 原站的「管理」页（/admin）和「实时」开关没有做。
- 每个游戏保留了西班牙语原名（`nameEs`），卡片上以小字显示，便于对照。
- 两个依赖西班牙语的诡计游戏（奶牛、音乐盒）在秘密里加了一句中文玩法的改法建议。

## 本地预览

```bash
cd baul-zh && python3 -m http.server 8765
```

然后打开 http://localhost:8765/ 。直接双击 `index.html` 也可以。

## 修改游戏数据

编辑 `games.json`，然后重新生成 `games.js`：

```bash
python3 -c "import json;d=json.load(open('games.json'));open('games.js','w').write('window.SEED_GAMES = '+json.dumps(d['games'],ensure_ascii=False)+';\n')"
```
