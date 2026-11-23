# IMA 知识库接口适配器（跨 AI 平台 · v23）

> 用途：同一份「速读」skill 要在多个 AI 平台（WorkBuddy、豆包、千问办公等）跑，各平台接 IMA 的方式不同。
> 本文件定义**如何判断当前平台的接口形态**并给出对应操作模板。所有涉及 IMA 入库的步骤都先读本文件，不要凭印象写字段。
>
> **核心原则**：意图固定，实现分叉。**按工具 schema 特征判断，不按平台名判断。**

## 一、为什么要分形态（背景，读懂再操作）

IMA 官方只有一套 OpenAPI，但各 AI 平台对它的封装分两种形态：

- **形态 A · 宿主封装态**：平台把 IMA OpenAPI 包装成自己的工具（如 WorkBuddy 的 `mcp__ima-mcp__*`）。特点是字段被简化：`add_knowledge` 有 `duplicate_name_strategy`，**没有** `media_type`/`title`/`file_info`；`create_media` 返回**预签名 URL**，PUT 即可，无需自己算签名。
- **形态 B · 原生 OpenAPI 态**：平台让 agent 直接打 IMA HTTP 接口（raw_call）。字段是官方原始定义：`add_knowledge` **必须**有 `media_type`/`title`/`file_info`，**没有** `duplicate_name_strategy`；`create_media` 返回 `cos_credential`（COS 临时密钥），需自己算 COS v5 签名再 PUT。

**两态字段互不兼容**：在形态 A 里传 B 的字段会报 `must NOT have additional properties`（校验失败）；在形态 B 里缺字段会报 `参数错误 110001`。必须先判定再操作。

> 已验证记录：形态 A 全流程在本机实测通过（create_media→PUT→add_knowledge→入库）；形态 B 的 COS v5 签名算法经本机实测 PUT 200 + ETag，add 字段来自千问办公端实测 code 0。两态上传的 COS 对象互相兼容，差异只在 add 阶段字段。

## 二、探测决策树（每次入库前先做）

读当前平台提供的 IMA 工具定义（`add_knowledge` 的 parameters schema），按下列顺序判断：

```
看 add_knowledge 的参数里有没有 duplicate_name_strategy：
  有 → 形态 A（宿主封装态）。再用 create_media 印证：返回 upload_url.presigned_url 则确认。
  没有，但有 media_type + title + file_info → 形态 B（原生 OpenAPI 态）。
      再用 create_media 印证：apply_upload_mode=2 返回 cos_credential 则确认。
  两者都没有 / 工具定义读不到 → 停止，按「第五节 · 未知形态处理」，不要猜。
```

判定后，在心里记住形态标签（A / B），后续所有 IMA 操作按对应模板执行。**一次任务内形态固定，不要中途混用。**

## 三、稳定层（两态共用，不受平台影响）

这些是 IMA 侧的固定标识与规则，两态完全一致：

| 项 | 值 |
| --- | --- |
| Skill 存档库 | `knowledge_base_id=ima_kb_SgMZpyuc` → 速读skill(`folder_7528667831885176`) → 默认版本(`folder_7528667924152336`)，文件名 `速读_v1.M.P.md` |
| 书籍笔记库 | `knowledge_base_id=ima_kb_fHDToMFu`（藏书阁），文件名 `[书名]_速读笔记.md` |
| 入库根目录 | 藏书阁根目录：形态 A 省略 `folder_id`；形态 B 省略 `folder_id`（根目录 folder_id 等于 knowledge_base_id） |
| 文件命名 | 存档 `速读_v1.M.P.md`（M=N//10, P=N%10）；笔记 `[书名]_速读笔记.md` |
| `file_size` | 必须是文件**实际字节数**，两态都校验；不一致会 403 |
| `content_type` | markdown 一律 `text/markdown` |
| 验证闭环 | 入库后用 `get_knowledge_list`（按 folder_id）或 `search_knowledge` 确认条目在位、摘要最新 |

## 四、形态 A 模板（宿主封装态 · MCP）

适用：工具是平台注入的具名工具（如 `mcp__ima-mcp__create_media`），schema 含 `duplicate_name_strategy`。

1. **create_media**：传 `knowledge_base_id`、`file_name`（含扩展名）、`file_ext`、`file_size`（实际字节数）、`content_type=text/markdown`、`apply_upload_mode=1`。
2. **保存返回**：`media_id` 与 `upload_url.presigned_url`（及 `auth_headers`）。
3. **PUT 上传**（urllib，原样携带签名头）：
   ```python
   import urllib.request
   data = open(本地文件,'rb').read()          # 长度必须 == file_size
   req = urllib.request.Request(presigned_url, data=data, method='PUT')
   req.add_header('Content-Type','text/markdown')
   req.add_header('Content-Length',str(len(data)))
   req.add_header('x-cos-acl','private')
   urllib.request.urlopen(req, timeout=60)    # 200 即成功
   ```
   > 注意：`auth_headers` 里若有 `x-cos-acl`，必须原样带上；Content-Length 与 create_media 声明的 file_size 必须完全一致，否则 403。
4. **add_knowledge**：传 `knowledge_base_id`、`media_id`（第 1 步返回）、需要的 `folder_id`、`duplicate_name_strategy="DUPLICATE_NAME_STRATEGY_REPLACE"`。**不要传 `media_type`/`title`/`file_info`。**
5. **验证**：按稳定层的验证闭环确认。

## 五、形态 B 模板（原生 OpenAPI 态 · raw_call）

适用：平台让 agent 通过裸 HTTP / raw_call 打 IMA OpenAPI，`add_knowledge` schema 含 `media_type`/`title`/`file_info`、无 `duplicate_name_strategy`。

### 第 1 步 create_media
`POST openapi/wiki/v1/create_media`，参数：`file_name`（含 `.md`）、`file_size`（实际字节数）、`content_type=text/markdown`、`knowledge_base_id`、`file_ext=md`、**`apply_upload_mode=2`**。
保存返回：`media_id` 与 `cos_credential`（含 `cos_key`/`secret_id`/`secret_key`/`token`/`start_time`/`expired_time`/`bucket_name`/`region`）。`cos_key` 留给第 3 步。

### 第 2 步 COS v5 签名 PUT
目标：`https://{bucket_name}.cos.{region}.myqcloud.com/{cos_key}`，方法 PUT，带 `Authorization` 和 `x-cos-security-token` 头。签名算法（本机实测 PUT 200 + ETag）：

```python
import hashlib, hmac, urllib.request
kt = f"{cred['start_time']};{cred['expired_time']}"
sign_key = hmac.new(cred['secret_key'].encode(), kt.encode(), hashlib.sha1).hexdigest()
http_string = f"put\n/{cred['cos_key']}\n\n\n"        # 无 query、无 header 参与签名
string_to_sign = f"sha1\n{kt}\n{hashlib.sha1(http_string.encode()).hexdigest()}\n"
sig = hmac.new(sign_key.encode(), string_to_sign.encode(), hashlib.sha1).hexdigest()
auth = (f"q-sign-algorithm=sha1&q-ak={cred['secret_id']}"
        f"&q-sign-time={kt}&q-key-time={kt}"
        "&q-header-list=&q-url-param-list=" f"&q-signature={sig}")
url = f"https://{cred['bucket_name']}.cos.{cred['region']}.myqcloud.com/{cred['cos_key']}"
data = open(本地文件,'rb').read()
req = urllib.request.Request(url, data=data, method='PUT')
req.add_header('Authorization', auth)
req.add_header('x-cos-security-token', cred['token'])
req.add_header('Content-Type','text/markdown')
req.add_header('Content-Length', str(len(data)))
urllib.request.urlopen(req, timeout=60)              # 200 + ETag
```
> 若平台用带 header 签名的变体（对方文档提到 `x-cos-security-token` 参与 signed headers），以平台 raw_call 能接受的形式为准；上面这是 header-list 为空的最小可用版，本机已实测通过。

### 第 3 步 add_knowledge（B 态核心差异）
`POST openapi/wiki/v1/add_knowledge`，body：
```json
{
  "media_type": 7,
  "media_id": "第1步返回的 media_id",
  "title": "含扩展名的文件名，必须与 file_name 完全一致，如 思考，快与慢_速读笔记.md",
  "knowledge_base_id": "目标库 id",
  "file_info": {
    "cos_key": "第1步 cos_credential.cos_key",
    "file_name": "含扩展名的文件名",
    "file_size": 实际字节数,
    "last_modify_time": 秒级时间戳
  }
}
```
- `media_type=7` 表示 Markdown。
- `title` **必须**等于含扩展名的 `file_name`，否则校验失败。
- 入根目录时**省略 `folder_id`**（根 folder_id 等于 knowledge_base_id）；入子文件夹才传 `folder_id`。
- **绝不传 `duplicate_name_strategy`**（B 态无此字段，会报参数错误）；同名替换由服务端按 `title` 处理。
- 成功返回 `{"code":0,"msg":"success",...}`。

### 第 4 步 验证
`get_media_info` 能取到原文地址、`search_knowledge` 在目标库检索到条目，即闭环。

## 六、失败回退与未知形态处理

| 报错 | 含义 | 处理 |
| --- | --- | --- |
| `must NOT have additional properties` | 在 A 态传了 B 的字段 | 切回形态 A 模板：去掉 `media_type`/`title`/`file_info`，加 `duplicate_name_strategy` |
| `参数错误 110001` / `invalid parameter` | 在 B 态缺字段或字段名错 | 切回形态 B 模板：补齐 `media_type`/`title`/`file_info`，删 `duplicate_name_strategy` |
| PUT 403 | file_size 与实际字节数不一致，或签名头缺失 | 重算文件实际字节数；A 态补 `x-cos-acl`，B 态确认 `Authorization` 与 token 头 |
| `invalid media_id` | 同一 media_id 重复 add | 重新走 create_media 拿新 media_id，不要复用 |

**未知形态**：若工具定义既不符合 A 也不符合 B，或读不到 schema——停止操作，在回复中明确告知用户「当前平台的 IMA 接口形态无法识别，需要补充适配」，并把看到的工具字段名列出来。**不要猜着传参**，猜错会污染入库状态。

**回退原则**：一个形态失败一次后，才切另一形态；不要两态同时试。切换前确认失败是「字段不匹配」而非网络/权限问题。

## 七、跨端使用检查清单

- [ ] 已按第二节判定形态（A / B），并记录了判定依据
- [ ] 库 ID、文件夹 ID、文件命名按稳定层，未随平台改动
- [ ] `file_size` 用实际字节数，与 create_media 声明一致
- [ ] A 态：add 只传 `duplicate_name_strategy`，无 B 态字段
- [ ] B 态：add 传齐 `media_type`/`title`/`file_info`，无 `duplicate_name_strategy`，`title` 含扩展名
- [ ] 入库后用 get_knowledge_list / search_knowledge 验证
- [ ] 失败按第六节回退，不两态混试

## 八、已验证环境记录（供参考，不替代探测）

| 平台 | 形态 | 状态 |
| --- | --- | --- |
| WorkBuddy | A（MCP 封装，预签名 URL） | 本机实测全流程通过；skill 存档 v22、16 本笔记均以此入库 |
| 千问办公 | B（raw_call，cos_credential） | 对方实测 add code 0；COS v5 签名算法本机实测 PUT 200 |
| 豆包 | 待确认（用户反馈已跑通） | 下次在该平台运行时按第二节探测确认具体形态，再回填本表 |
