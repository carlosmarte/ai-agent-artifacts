from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Issue:
    code: str
    severity: str  # "error" | "warn"
    field: str
    message: str
    source_offset: Optional[int] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DepRef:
    name: str
    version_range: Optional[str]
    origin: str  # "in_repo" | "cross_repo"
    owner: Optional[str] = None
    repo: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Parsed:
    name: Optional[str]
    description: Optional[str]
    tier: Optional[str]
    license: Optional[str]
    compatibility: Optional[str]
    metadata: dict
    allowed_tools: list
    dependencies: list  # list[DepRef]
    body: str
    source_offset: int
    raw_frontmatter: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "tier": self.tier,
            "license": self.license,
            "compatibility": self.compatibility,
            "metadata": dict(self.metadata),
            "allowed_tools": list(self.allowed_tools),
            "dependencies": [d.to_dict() for d in self.dependencies],
            "body": self.body,
            "source_offset": self.source_offset,
        }


@dataclass
class Report:
    path: str
    status: str  # "PASS" | "FAIL" | "WARN"
    issues: list  # list[Issue]
    summary: dict = field(default_factory=lambda: {"errors": 0, "warnings": 0})

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "status": self.status,
            "issues": [i.to_dict() for i in self.issues],
            "summary": dict(self.summary),
        }
