# UI Tree 可视化（astrbot_plugin_uitree）

把 Claude Code 的 `ui.render` 可视化 **mod** 抽离成一个独立的 **UI 元素树渲染器**，跑在
[AstrBot](https://github.com/Soulter/AstrBot) 上。Agent 不再只能输出纯文本 —— 它可以动态生成
表单、状态面板、文件树等界面结构，并在插件页里以三种视图实时渲染：

- **元素树（tree）** —— 左侧可折叠的节点层级，点任意节点看 `props` / `state`；
- **实时预览（preview）** —— 按元素类型渲染出的真实界面；
- **JSON** —— 直接编辑整棵树并「应用」。

> 灵感来源：Claude Code 的 `ui.render` 函数钩子把界面描述成一棵由
> `Pane` / `Box` / `Text` / `Button` / `Tabs` 等组成的树。本项目把这个**数据模型**抽离为
> 与框架无关的 JSON，并在 AstrBot 里独立实现了一套渲染器。

---

## 目录结构

```
astrbot_plugin_uitree/
├── metadata.yaml            # AstrBot 插件清单
├── _conf_schema.json        # 配置项（auto_seed_demo / persist_tree）
├── requirements.txt         # 无第三方依赖
├── main.py                  # Star 插件入口：Web API + LLM 工具
├── uitree/__init__.py       # 元素树数据模型 + 校验 + 三套预设
├── pages/uitree/            # 插件页（官方 window.AstrBotPluginPage bridge）
│   ├── index.html
│   ├── style.css
│   ├── renderer.js          # 纯函数渲染器（树视图 / 预览 / JSON）
│   └── app.js               # 页面控制器
├── skills/uitree-render/SKILL.md   # 供 Agent 使用的技能说明
├── demo/index.html          # 独立演示（不装 AstrBot 也能看）
├── sandbox_demo.py          # 零依赖沙箱测试（模型 + 校验）
└── screenshots/             # 三套预设的截图
```

## 安装

把本目录复制到 AstrBot 的插件目录，或通过插件市场安装：

```
data/plugins/astrbot_plugin_uitree/
```

要求：AstrBot `>=4.26.0`，Python 3.10+。无第三方依赖，仅用标准库 + AstrBot 提供的 API。

## 元素树模型

每个节点统一为：

```json
{"type": "Stat", "props": {"label": "工具调用", "value": "3", "hint": "累计"}, "state": {}}
```

- `type` —— 元素类型，必须在集合内；
- `props` —— 展示属性（`label` / `value` / `variant` / `tabs` / `direction` / `gap` …）；
- `state` —— 运行时状态（如 `Tabs.active`）；
- `children` —— 仅容器类型可携带。

**容器类型**：`Pane`、`Box`、`Row`、`Column`、`Tabs`、`List`、`ListItem`
**叶子类型**：`Text`、`Button`、`Badge`、`Progress`、`Stat`、`Divider`、`Spacer`

## 三套预设（对应 Claude Code mod）

| 预设 | 说明 | 对应 mod |
|------|------|----------|
| `session` | 会话工作台：工具调用统计 + 进度 + Tabs + 按钮 | `autonomous-loop` / `first-mod` / `token-weather` |
| `filetree` | IDE 式文件树面板 | `filetree` |
| `form` | Agent 动态生成的表单（生成式 UI 典型场景） | 动态表单 |

## 暴露的接口

**Web API**（插件页 `window.AstrBotPluginPage` 调用）：

- `GET  /astrbot_plugin_uitree/tree` —— 当前树 + 预设列表；
- `POST /astrbot_plugin_uitree/tree` —— 校验并写入新树；
- `GET  /astrbot_plugin_uitree/preset?name=session` —— 载入某个预设。

**LLM 工具**（聊天中可用）：

- `uitree_current` —— 查看当前树的结构摘要；
- `uitree_load_preset(name)` —— 载入内置预设并返回其 JSON。

## 测试与截图

本机未安装 AstrBot，因此分两层验证：

1. **模型层（零依赖）**：
   ```bash
   python sandbox_demo.py
   ```
   输出 `validated: true` / `roundtrip_ok: true` / `rejected_invalid: 3` 的摘要 —— 校验三套预设、
   JSON 往返一致，并拒绝 3 类非法结构。

2. **渲染层**：用 Edge headless 对 `demo/index.html` 抓取 DOM 并截图，确认 13 种元素类型徽标
   全部正确渲染。截图见 `screenshots/`（`session.png` / `filetree.png` / `form.png`）。

完整端到端测试（插件页 + `AstrBotPluginPage` bridge + 持久化）需在安装了 AstrBot 的实例上进行。
