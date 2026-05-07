"""Esporta una sessione Claude Code (JSONL) in Markdown leggibile.

Sorgente: ~/.claude/projects/<project-hash>/<session-id>.jsonl
Output:   conversation-export.md (project root by default)

Conventions:
- Skip thinking blocks (privati, ridondanti col testo finale)
- Summarize tool calls (nome + param chiave) invece di emettere i payload
  raw, altrimenti il file diventa una palude di JSON
- User text -> blockquote
- Assistant text -> normal markdown
- Tool results pesanti vengono troncati a poche righe

Uso:
    python scripts/export-conversation.py [JSONL_PATH] [OUTPUT_PATH]
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_JSONL = (
    Path.home()
    / ".claude/projects"
    / "c--Users-andre-Desktop-Sherdan-7--DM-Tools-Sherdan-DM-Tools"
    / "14b2c38e-d6d6-4e5c-bf7d-c482f4ea2e6c.jsonl"
)
DEFAULT_OUT = Path("conversation-export.md")

MAX_TOOL_RESULT_LINES = 12
MAX_TOOL_PARAM_CHARS = 200


def fmt_ts(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return iso


def summarize_tool_use(block: dict) -> str:
    name = block.get("name", "?")
    inp = block.get("input", {})
    if not isinstance(inp, dict):
        return f"`{name}`"
    # Show 1-3 most informative keys
    candidates = [
        "command",
        "description",
        "prompt",
        "file_path",
        "path",
        "pattern",
        "old_string",
        "new_string",
        "content",
        "query",
    ]
    parts = []
    for k in candidates:
        if k in inp:
            v = str(inp[k]).replace("\n", " ").strip()
            if len(v) > MAX_TOOL_PARAM_CHARS:
                v = v[:MAX_TOOL_PARAM_CHARS] + "…"
            parts.append(f"{k}={v!r}")
            if len(parts) >= 2:
                break
    if not parts:
        for k, v in list(inp.items())[:1]:
            v = str(v).replace("\n", " ").strip()
            if len(v) > MAX_TOOL_PARAM_CHARS:
                v = v[:MAX_TOOL_PARAM_CHARS] + "…"
            parts.append(f"{k}={v!r}")
    if parts:
        return f"`{name}({', '.join(parts)})`"
    return f"`{name}`"


def truncate_text(s: str, max_lines: int = MAX_TOOL_RESULT_LINES) -> str:
    lines = s.splitlines()
    if len(lines) <= max_lines:
        return s
    head = "\n".join(lines[: max_lines - 2])
    rest = len(lines) - (max_lines - 2)
    return f"{head}\n… [{rest} righe omesse]"


def render_user(message: dict, ts: str) -> list[str]:
    out: list[str] = [f"## [{fmt_ts(ts)}] User", ""]
    content = message.get("content", "")
    if isinstance(content, str):
        for line in content.splitlines() or [""]:
            out.append(f"> {line}" if line else ">")
    elif isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                txt = block.get("text", "")
                for line in txt.splitlines() or [""]:
                    out.append(f"> {line}" if line else ">")
            elif btype == "tool_result":
                tool_id = block.get("tool_use_id", "")[:8]
                content_field = block.get("content", "")
                # tool_result content puo' essere stringa o lista di blocchi
                if isinstance(content_field, list):
                    text_parts = []
                    for sub in content_field:
                        if isinstance(sub, dict) and sub.get("type") == "text":
                            text_parts.append(sub.get("text", ""))
                    content_field = "\n".join(text_parts)
                if not isinstance(content_field, str):
                    content_field = str(content_field)
                truncated = truncate_text(content_field)
                out.append(f"<details><summary>↩ tool result ({tool_id})</summary>")
                out.append("")
                out.append("```")
                out.append(truncated)
                out.append("```")
                out.append("")
                out.append("</details>")
    out.append("")
    return out


def render_assistant(message: dict, ts: str) -> list[str]:
    content = message.get("content", [])
    if not isinstance(content, list):
        return []
    text_parts: list[str] = []
    tool_calls: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "text":
            text_parts.append(block.get("text", ""))
        elif btype == "tool_use":
            tool_calls.append(summarize_tool_use(block))
        # 'thinking' deliberatamente skippato
    text_parts = [t for t in (p.strip() for p in text_parts) if t]
    # Se la message JSONL conteneva solo thinking, non emettere un header
    # vuoto: silenzio piu' utile del rumore.
    if not text_parts and not tool_calls:
        return []
    out: list[str] = [f"## [{fmt_ts(ts)}] Assistant", ""]
    if text_parts:
        out.append("\n\n".join(text_parts))
        out.append("")
    if tool_calls:
        out.append("**Strumenti chiamati:**")
        for t in tool_calls:
            out.append(f"- {t}")
        out.append("")
    return out


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_JSONL
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT

    if not src.exists():
        print(f"file non trovato: {src}", file=sys.stderr)
        return 1

    lines: list[str] = []
    user_count = 0
    asst_count = 0
    first_ts = None
    last_ts = None

    with src.open(encoding="utf-8") as fh:
        for raw in fh:
            try:
                obj = json.loads(raw)
            except json.JSONDecodeError:
                continue
            t = obj.get("type")
            if t not in ("user", "assistant"):
                continue
            ts = obj.get("timestamp", "")
            if first_ts is None:
                first_ts = ts
            last_ts = ts
            msg = obj.get("message", {})
            if t == "user":
                rendered = render_user(msg, ts)
                if rendered:
                    user_count += 1
                    lines.extend(rendered)
                    lines.append("---")
                    lines.append("")
            else:
                rendered = render_assistant(msg, ts)
                if rendered:
                    asst_count += 1
                    lines.extend(rendered)
                    lines.append("---")
                    lines.append("")

    header = [
        "# Conversazione Claude Code — Sherdan DM Tools",
        "",
        f"- Sessione: `{src.stem}`",
        f"- Periodo: {fmt_ts(first_ts or '')} → {fmt_ts(last_ts or '')}",
        f"- Messaggi utente: {user_count}",
        f"- Messaggi assistente: {asst_count}",
        "",
        "Note: thinking blocks omessi; tool call riassunti; tool result lunghi"
        " troncati. Per il transcript raw vedi il JSONL sorgente.",
        "",
        "---",
        "",
    ]

    dst.write_text("\n".join(header + lines), encoding="utf-8")
    size_kb = dst.stat().st_size / 1024
    print(f"scritto: {dst} ({size_kb:.0f} KB, {user_count}+{asst_count} messaggi)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
