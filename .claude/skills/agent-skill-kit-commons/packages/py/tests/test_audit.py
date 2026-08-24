from pathlib import Path


from skills_ref.audit.deps_origin import audit_dep_origins
from skills_ref.audit.frontmatter import audit_frontmatter
from skills_ref.audit.path_leak import audit_path_leak
from skills_ref.audit.printer import format_audit
from skills_ref.audit.scripts import audit_scripts
from skills_ref.registry import build_registry


def _mk_skill(root: Path, name: str, frontmatter_text: str, body: str = "body content") -> Path:
    d = root / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "SKILL.md").write_text(f"---\n{frontmatter_text}\n---\n{body}\n", encoding="utf-8")
    return d


def test_frontmatter_flags_unauthorized(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-bad",
        "name: org-bad\ndescription: D\ntier: org\nclaude-priority: high",
    )
    reg = build_registry(str(tmp_path))
    f = audit_frontmatter(reg)
    assert len(f) == 1
    assert f[0]["code"] == "A001_UNAUTHORIZED_FIELD"
    assert f[0]["severity"] == "MEDIUM"
    assert f[0]["where"].endswith(":claude-priority")


def test_frontmatter_clean_allowlist(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-good",
        "name: org-good\ndescription: D\ntier: org\nlicense: Apache-2.0",
    )
    assert audit_frontmatter(build_registry(str(tmp_path))) == []


def test_scripts_flags_subprocess_shell_true(tmp_path: Path):
    d = _mk_skill(tmp_path, "org-scripts", "name: org-scripts\ndescription: D\ntier: org")
    (d / "scripts").mkdir()
    (d / "scripts" / "inject.py").write_text(
        "import subprocess\nsubprocess.run(cmd, shell=True)\n", encoding="utf-8"
    )
    reg = build_registry(str(tmp_path))
    f = audit_scripts(reg)
    sp = [x for x in f if "subprocess-shell" in x["message"]]
    assert len(sp) == 1
    assert sp[0]["severity"] == "HIGH"
    assert sp[0]["where"].endswith("inject.py:2")


def test_scripts_no_flag_on_safe(tmp_path: Path):
    d = _mk_skill(tmp_path, "org-clean", "name: org-clean\ndescription: D\ntier: org")
    (d / "scripts").mkdir()
    (d / "scripts" / "safe.py").write_text(
        "import subprocess\nsubprocess.run(['ls'])\n", encoding="utf-8"
    )
    assert audit_scripts(build_registry(str(tmp_path))) == []


def test_deps_origin_medium_when_no_allowlist(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-a",
        "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    )
    f = audit_dep_origins(build_registry(str(tmp_path)))
    assert len(f) == 1
    assert f[0]["severity"] == "MEDIUM"
    assert f[0]["code"] == "A020_UNVETTED_ORIGIN"


def test_deps_origin_allowed(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-a",
        "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    )
    assert audit_dep_origins(build_registry(str(tmp_path)), allowed_origins=["acme"]) == []


def test_deps_origin_high_when_allowlist_excludes(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-a",
        "name: org-a\ndescription: D\ntier: org\ndependencies:\n  - acme/governance#security-baseline",
    )
    f = audit_dep_origins(build_registry(str(tmp_path)), allowed_origins=["other"])
    assert len(f) == 1
    assert f[0]["severity"] == "HIGH"


def test_path_leak_in_body(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-leaky",
        "name: org-leaky\ndescription: D\ntier: org",
        "this path /Users/foo/bar leaks the layout.",
    )
    f = audit_path_leak(build_registry(str(tmp_path)))
    assert len(f) == 1
    assert f[0]["code"] == "A030_HOST_PATH_LEAK"


def test_path_leak_ignores_fenced_bash(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-doc",
        "name: org-doc\ndescription: D\ntier: org",
        "Run this:\n\n```bash\nls /Users/foo/bar\n```\n",
    )
    assert audit_path_leak(build_registry(str(tmp_path))) == []


def test_path_leak_ignores_blockquote(tmp_path: Path):
    _mk_skill(
        tmp_path,
        "org-quote",
        "name: org-quote\ndescription: D\ntier: org",
        "> example: /Users/foo/bar in a quote",
    )
    assert audit_path_leak(build_registry(str(tmp_path))) == []


def test_format_audit_human_summary_and_order():
    out = format_audit(
        [
            {"severity": "MEDIUM", "code": "X", "where": "w1", "message": "m1"},
            {"severity": "HIGH", "code": "Y", "where": "w2", "message": "m2"},
        ],
        "human",
    )
    assert out.startswith("[HIGH]")
    assert "[MEDIUM]" in out
    assert "summary: 1 HIGH, 1 MEDIUM, 0 LOW" in out
