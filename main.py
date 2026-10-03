"""AstrBot 入口：UI Tree 可视化 mod 插件。

把 Claude Code 的 ``ui.render`` 可视化 mod 抽离为独立元素树渲染器，
通过 AstrBot Plugin Page 与聊天工具暴露。Plugin Page 使用官方
``pages/<page>/index.html`` 与 ``window.AstrBotPluginPage`` bridge。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from astrbot.api import AstrBotConfig, logger
from astrbot.api.event import AstrMessageEvent, filter
from astrbot.api.star import Context, Star
from astrbot.api.web import error_response, json_response, request
from astrbot.core.utils.astrbot_path import get_astrbot_data_path

from .uitree import DEMO_TREE, PLUGIN_NAME, PRESETS, describe_tree, validate_tree


class UITreePlugin(Star):
    def __init__(self, context: Context, config: AstrBotConfig):
        super().__init__(context)
        self.config = config

        data_dir = Path(get_astrbot_data_path()) / "plugin_data" / PLUGIN_NAME
        data_dir.mkdir(parents=True, exist_ok=True)
        self._tree_file = data_dir / "tree.json"

        self.tree = dict(DEMO_TREE)
        if self.config.get("auto_seed_demo", True) and self._tree_file.exists():
            try:
                self.tree = json.loads(self._tree_file.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                logger.warning("UI Tree：tree.json 损坏，已回退到演示预设")
        elif self.config.get("auto_seed_demo", True):
            self._save()

        context.register_web_api(
            f"/{PLUGIN_NAME}/tree", self.api_tree, ["GET", "POST"], "tree"
        )
        context.register_web_api(
            f"/{PLUGIN_NAME}/preset", self.api_preset, ["GET"], "preset"
        )

    def _save(self) -> None:
        if not self.config.get("persist_tree", True):
            return
        self._tree_file.write_text(
            json.dumps(self.tree, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # ------------------------------------------------------------------ #
    # Web API（Plugin Page bridge 调用）                                  #
    # ------------------------------------------------------------------ #

    async def api_tree(self):
        if request.method == "GET":
            return json_response({"tree": self.tree, "presets": list(PRESETS)})
        data = await request.json(default={})
        try:
            self.tree = validate_tree(data.get("tree", {}))
            self._save()
            return json_response({"ok": True, "tree": self.tree})
        except ValueError as exc:
            return error_response(str(exc), status_code=400)

    async def api_preset(self):
        name = str(request.query.get("name", "session"))
        preset = PRESETS.get(name)
        if preset is None:
            return error_response(f"未知预设 {name!r}，可选：{', '.join(PRESETS)}", status_code=404)
        return json_response({"tree": preset})

    # ------------------------------------------------------------------ #
    # 聊天工具                                                            #
    # ------------------------------------------------------------------ #

    @filter.llm_tool(name="uitree_current")
    async def current_tree(self, event: AstrMessageEvent):
        """查看当前 UI 元素树的结构摘要。

        返回当前树包含的元素类型与节点数；完整可视化请在插件页「UI Tree」查看。
        """
        summary = await asyncio.to_thread(describe_tree, self.tree)
        yield event.plain_result(
            f"{summary}。完整可视化与编辑请打开插件页「UI Tree」。"
        )

    @filter.llm_tool(name="uitree_load_preset")
    async def load_preset(self, event: AstrMessageEvent, name: str):
        """载入一个内置 UI 元素树预设并返回其 JSON。

        Args:
            name(string): 预设名，可选 session、filetree、form
        """
        preset = PRESETS.get(name)
        if preset is None:
            yield event.plain_result(f"未知预设 {name!r}，可选：session、filetree、form")
            return
        self.tree = dict(preset)
        self._save()
        yield event.plain_result(
            f"已载入预设 {name}（{describe_tree(self.tree)}）。"
            f" JSON：{json.dumps(self.tree, ensure_ascii=False)}"
        )

    async def terminate(self):
        logger.info("UI Tree 可视化插件已停止")
