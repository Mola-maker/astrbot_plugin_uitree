"""UI Tree —— 抽离自 Claude Code ``ui.render`` 可视化 mod 的元素树模型。

Claude Code 的 ``ui.render`` 函数钩子把界面绘制成一棵由
``Pane`` / ``Box`` / ``Text`` / ``Button`` / ``Tabs`` 等元素组成的**树**，
并实时渲染成真正的界面。本模块把这个想法抽离成一个与框架无关的
JSON 数据模型，并附带三套「Claude Code mod 风格」的演示预设：

- ``session``   对应官方 ``autonomous-loop`` / ``first-mod`` / ``token-weather``
- ``filetree``  对应 ``filetree`` mod 的 IDE 式文件树面板
- ``form``      对应 agent 动态生成表单（生成式 UI 的典型场景）

节点结构统一为：:

    {"type": "...", "props": {...}, "state": {...}, "children": [...]}

其中 ``children`` 只允许出现在容器类型上；叶子类型（Text / Button / Badge /
Progress / Stat / Divider / Spacer）不携带子节点。
"""

from __future__ import annotations

from typing import Any

PLUGIN_NAME = "astrbot_plugin_uitree"

#: 元素类型集合。容器类型可携带 children，叶子类型不可。
ELEMENT_TYPES = (
    "Pane", "Box", "Row", "Column", "Text", "Button", "Badge",
    "Progress", "Stat", "Tabs", "List", "ListItem", "Divider", "Spacer",
)

CONTAINER_TYPES = {"Pane", "Box", "Row", "Column", "Tabs", "List", "ListItem"}


def validate_tree(node: Any, path: str = "root") -> dict:
    """校验并规范化一棵 UI 元素树。

    返回一个规整后的节点字典；任何结构问题都会抛出 ``ValueError``，
    消息里带出错路径（例如 ``root.children.1``），方便前端定位。
    """
    if not isinstance(node, dict):
        raise ValueError(f"{path}: 节点必须是对象")
    node_type = node.get("type")
    if node_type not in ELEMENT_TYPES:
        raise ValueError(
            f"{path}: 未知元素类型 {node_type!r}，可选：{', '.join(ELEMENT_TYPES)}"
        )

    normalized: dict[str, Any] = {
        "type": node_type,
        "props": node.get("props") if isinstance(node.get("props"), dict) else {},
        "state": node.get("state") if isinstance(node.get("state"), dict) else {},
    }

    children = node.get("children", [])
    if children:
        if node_type not in CONTAINER_TYPES:
            raise ValueError(f"{path}: 类型 {node_type} 不接受子节点")
        if not isinstance(children, list):
            raise ValueError(f"{path}: children 必须是数组")
        normalized["children"] = [
            validate_tree(child, f"{path}.children.{index}")
            for index, child in enumerate(children)
        ]
    return normalized


def _stat(label: str, value: str, hint: str = "") -> dict:
    return {"type": "Stat", "props": {"label": label, "value": value, "hint": hint}}


def _button(label: str, action: str, variant: str = "primary") -> dict:
    return {"type": "Button", "props": {"label": label, "action": action, "variant": variant}}


def _text(value: str, variant: str = "body") -> dict:
    return {"type": "Text", "props": {"value": value, "variant": variant}}


# 预设 1：会话工作台（autonomous-loop / first-mod / token-weather 的合体）
SESSION_TREE = {
    "type": "Pane",
    "props": {"title": "会话工作台", "subtitle": "autonomous-loop · token-weather · first-mod"},
    "state": {"running": True},
    "children": [
        {
            "type": "Column",
            "props": {"gap": 3},
            "children": [
                {
                    "type": "Row",
                    "props": {"gap": 2},
                    "children": [
                        _stat("工具调用", "3", "累计"),
                        _stat("上下文", "72%", "已用窗口"),
                        _stat("耗时", "12.4s", "本轮"),
                    ],
                },
                _text("Autonomous loop 运行中，agent 正在自主推进。", "heading"),
                {
                    "type": "Progress",
                    "props": {"label": "上下文窗口", "value": 72},
                },
                {
                    "type": "Tabs",
                    "props": {"tabs": ["树视图", "渲染预览", "JSON"]},
                    "state": {"active": 1},
                },
                {
                    "type": "Row",
                    "props": {"gap": 2},
                    "children": [
                        _button("刷新", "refresh", "primary"),
                        _button("暂停", "pause", "ghost"),
                        {"type": "Badge", "props": {"label": "运行中", "variant": "ok"}},
                    ],
                },
            ],
        }
    ],
}

# 预设 2：IDE 式文件树（filetree mod）
FILETREE_TREE = {
    "type": "Pane",
    "props": {"title": "文件树", "subtitle": "filetree mod · agent 读写轨迹"},
    "children": [
        {
            "type": "List",
            "children": [
                {"type": "ListItem", "props": {"label": "src/", "kind": "folder", "open": True}},
                {"type": "ListItem", "props": {"label": "  main.py", "kind": "file", "status": "edited"}},
                {"type": "ListItem", "props": {"label": "  renderer.js", "kind": "file", "status": "written"}},
                {"type": "ListItem", "props": {"label": "pages/", "kind": "folder", "open": True}},
                {"type": "ListItem", "props": {"label": "  index.html", "kind": "file", "status": "read"}},
                {"type": "ListItem", "props": {"label": "tests/", "kind": "folder", "open": False}},
            ],
        }
    ],
}

# 预设 3：Agent 动态生成的表单（生成式 UI 典型场景）
FORM_TREE = {
    "type": "Pane",
    "props": {"title": "预订航班", "subtitle": "agent 根据用户请求动态生成的表单"},
    "children": [
        {
            "type": "Column",
            "props": {"gap": 2},
            "children": [
                _text("请确认以下信息，完成后 agent 继续为你预订。", "body"),
                {"type": "Text", "props": {"value": "出发地 · 城市", "variant": "label"}},
                {"type": "Text", "props": {"value": "上海 (PVG)", "variant": "value"}},
                {"type": "Text", "props": {"value": "目的地 · 城市", "variant": "label"}},
                {"type": "Text", "props": {"value": "北京 (PEK)", "variant": "value"}},
                {"type": "Divider", "props": {}},
                {
                    "type": "Row",
                    "props": {"gap": 2},
                    "children": [
                        _button("确认预订", "confirm", "primary"),
                        _button("修改信息", "edit", "secondary"),
                    ],
                },
                {"type": "Badge", "props": {"label": "待用户确认", "variant": "warn"}},
            ],
        }
    ],
}

#: 前端与 LLM 工具共用：预设名 -> 树
PRESETS = {
    "session": SESSION_TREE,
    "filetree": FILETREE_TREE,
    "form": FORM_TREE,
}

#: 默认载入的树
DEMO_TREE = SESSION_TREE


def node_count(node: dict) -> int:
    """统计树中节点总数，用于日志与前端脚注。"""
    return 1 + sum(node_count(child) for child in node.get("children", []))


def describe_tree(node: dict) -> str:
    """生成树的紧凑单行描述，供 LLM 工具返回。"""
    types = _count_types(node)
    summary = "，".join(f"{name}×{count}" for name, count in types.items())
    return f"UI 树 {node_count(node)} 节点：{summary}"


def _count_types(node: dict, acc: dict | None = None) -> dict:
    acc = acc if acc is not None else {}
    acc[node["type"]] = acc.get(node["type"], 0) + 1
    for child in node.get("children", []):
        _count_types(child, acc)
    return acc
