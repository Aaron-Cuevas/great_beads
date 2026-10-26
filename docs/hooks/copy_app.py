import shutil
from pathlib import Path


def on_post_build(config, **kwargs):
    src = Path(config["config_file_path"]).parent / "planner"
    if src.is_dir():
        shutil.copytree(src, Path(config["site_dir"]) / "app", dirs_exist_ok=True)
