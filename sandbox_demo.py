"""零依赖沙箱演示：不装 AstrBot 也能跑通 UI 树模型与校验。

用法：::

    python sandbox_demo.py

输出含 ``validated: true`` 的 JSON 摘要；结束不产生任何残留文件。
"""

from __future__ import annotations

import json

from uitree import PRESETS, describe_tree, node_count, validate_tree


def main() -> None:
    report = {"presets": {}, "validated": False, "roundtrip_ok": False}

    for name, tree in PRESETS.items():
        normalized = validate_tree(tree)
        report["presets"][name] = {
            "nodes": node_count(normalized),
            "summary": describe_tree(normalized),
        }

    # 校验应拒绝非法结构
    bad_inputs = [
        {"type": "TextBox"},                       # 未知类型
        {"type": "Text", "children": [{"type": "Text", "props": {}}]},  # 叶子带子节点
        {"type": "Pane", "children": "nope"},       # children 不是数组
    ]
    report["rejected_invalid"] = 0
    for bad in bad_inputs:
        try:
            validate_tree(bad)
        except ValueError:
            report["rejected_invalid"] += 1

    # JSON 往返：序列化后再解析，结果应一致
    rt = validate_tree(json.loads(json.dumps(PRESETS["session"], ensure_ascii=False)))
    report["roundtrip_ok"] = rt == validate_tree(PRESETS["session"])
    report["validated"] = report["rejected_invalid"] == len(bad_inputs)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
