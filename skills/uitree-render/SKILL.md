---
name: uitree-render
description: Render a live UI element tree (Pane/Box/Text/Button/Tabs/...) using the astrbot_plugin_uitree plugin, mirroring Claude Code's ui.render mod.
---

# UI Tree 渲染

把 Agent 想表达的界面结构组织成一棵**元素树**，由 `astrbot_plugin_uitree`
插件在 AstrBot 插件页「UI Tree」中以树视图 / 实时预览 / JSON 三种方式渲染。

## 元素类型

容器（可带 `children`）：`Pane`、`Box`、`Row`、`Column`、`Tabs`、`List`、`ListItem`
叶子（无子节点）：`Text`、`Button`、`Badge`、`Progress`、`Stat`、`Divider`、`Spacer`

## 节点结构

```json
{"type": "Stat", "props": {"label": "工具调用", "value": "3", "hint": "累计"}, "state": {}}
```

- `type` —— 元素类型，必须在上述集合内。
- `props` —— 展示属性（`label` / `value` / `variant` / `tabs` / `direction` / `gap` …）。
- `state` —— 运行时状态（如 `Tabs` 的 `active`、`Progress` 的进度）。
- `children` —— 仅容器类型可用。

## 使用方式

1. 需要可视化某个结构时，先用 `uitree_load_preset` 看一个预设长什么样。
2. 描述一棵树时直接给出 JSON，交给插件页「JSON」视图粘贴并「应用」。
3. 检查树的当前状态用 `uitree_current`；载入内置预设用 `uitree_load_preset`。

约定：`Text` 的 `variant` 支持 `label` / `body` / `heading` / `value`；
`Button` 的 `variant` 支持 `primary` / `secondary` / `ghost`；
`Badge` 的 `variant` 支持 `ok` / `warn` / `info`；
`Progress` 用 `props.value`（0–100）表示进度。
