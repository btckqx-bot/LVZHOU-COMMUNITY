# -*- coding: utf-8 -*-
"""多重深读 · 跨讲者关联分析前置脚本。
从多重 data 导出观点索引（编号|讲者|层级|标题），供 agent 分析跨讲者关联。

用法：
  python gen_cross_prompt.py <multi_data.json> <out_index.txt> [out_prompt.txt]
输出：
  - index.txt：一行一观点，供 agent 读
  - prompt.txt：可直接发给 agent 的跨讲者关联分析任务说明（含输出格式）
"""
import json, sys
from pathlib import Path

def main():
    if len(sys.argv) < 3:
        print('用法: python gen_cross_prompt.py <multi_data.json> <out_index.txt> [out_prompt.txt]'); sys.exit(1)
    d = json.load(open(sys.argv[1], encoding='utf-8'))
    docs = d['docs']
    lines = []
    for doc in docs:
        for v in doc['ideas']:
            lines.append(f"{v['no']:>4} | {doc['name']:<8} | {v.get('level',''):<6} | {v['title']}")
    Path(sys.argv[2]).write_text('\n'.join(lines), encoding='utf-8')
    speakers = '、'.join(x['name'] for x in docs)
    prompt = f"""你在为多重深读演示稿设计【跨讲者横向关联】。用户诉求："打破次元壁——不同讲者的观点，如果有思想关联，也要在星云图里连在一起。"

【输入】观点索引：{sys.argv[2]}（格式：编号 | 讲者 | 层级 | 标题）；{len(docs)} 位讲者：{speakers}。详细内容查 data.json 的 docs[].ideas。

【任务】找出**跨讲者**观点间的真实思想关联：
- 呼应：不同讲者独立提出同一判断
- 对照：观点相反或互补（有张力）
- 支撑：一家的机制为另一家提供理论依据
- 应用：一家的框架被另一家的案例印证

【输出】写 JSON 数组到 cross_refs.json：
[{{"a":编号,"b":编号,"type":"呼应|对照|支撑|应用","reason":"20-50字具体理由，提到双方核心主张"}}]
- a、b 必须来自**不同讲者**；每条观点最多 4 条；目标 50-80 条，覆盖全部讲者两两互通；不重复、不硬凑。

【完成后只返回】关联条数、覆盖的讲者对、几个典型例子。不要粘贴全部 JSON。"""
    if len(sys.argv) > 3:
        Path(sys.argv[3]).write_text(prompt, encoding='utf-8')
        print('written', sys.argv[2], 'and', sys.argv[3], f'({len(lines)} ideas, {len(docs)} docs)')
    else:
        print('written', sys.argv[2], f'({len(lines)} ideas, {len(docs)} docs)')

if __name__ == '__main__':
    main()
