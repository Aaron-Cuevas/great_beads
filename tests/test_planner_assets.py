import re
from pathlib import Path

import pytest

PLANNER = Path(__file__).resolve().parents[1] / "planner"
INDEX = PLANNER / "index.html"
needs_planner = pytest.mark.skipif(not INDEX.exists(), reason="planner not imported yet")


@needs_planner
def test_planner_files_exist():
    html = INDEX.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="([^"#:]+)"', html)
    missing = [r for r in refs if not (PLANNER / r).exists()]
    assert not missing, f"planner/index.html points to missing files: {missing}"


@needs_planner
def test_planner_is_offline():
    html = INDEX.read_text(encoding="utf-8")
    remote = re.findall(r'(?:src|href)="(https?://[^"]+)"', html)
    assert not remote, f"planner/index.html loads from the network: {remote}"
