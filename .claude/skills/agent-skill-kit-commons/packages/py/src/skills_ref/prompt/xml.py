from __future__ import annotations

_ESC = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"}


def xml_escape(s) -> str:
    if s is None:
        return ""
    out = []
    for c in str(s):
        out.append(_ESC.get(c, c))
    return "".join(out)


def serialize_available_skills(entries, truncated: int = 0) -> str:
    out = "<available_skills>\n"
    for e in entries:
        out += f'  <skill name="{xml_escape(e["name"])}" tier="{xml_escape(e["tier"])}"'
        if e.get("invalid"):
            out += ' invalid="true"'
        out += f'>{xml_escape(e.get("description"))}</skill>\n'
    if truncated > 0:
        out += f'  <truncated count="{truncated}"/>\n'
    out += "</available_skills>\n"
    return out
