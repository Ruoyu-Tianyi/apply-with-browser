"""Build local import archives from the shared apply-with-browser instructions."""

import argparse
import json
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
NAME = "apply-with-browser"
SKILL = ROOT / "skills" / NAME
REFERENCES = (
    "references/controls.md",
    "references/dates.md",
    "references/education.md",
    "references/runtime.md",
    "references/statements.md",
)


def workbuddy_entrypoint(source: str) -> str:
    _, frontmatter, body = source.split("---\n", 2)
    description = next(
        line.removeprefix("description: ")
        for line in frontmatter.splitlines()
        if line.startswith("description: ")
    )
    fields = {
        "name": NAME,
        "display_name": "网申填写助手",
        "display_name_en": "Apply with Browser",
        "description": description,
        "description_zh": "根据用户资料填写并核验网申与在线简历。",
        "description_en": "Fill and verify applications and online resumes using the user's materials.",
        "version": "1.0.1",
        "author": "Apply with Browser contributors",
    }
    header = "\n".join(
        f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in fields.items()
    )
    body = re.sub(r"\]\((references/[^)]+\.md)\)", r"](\1) @\1 ", body)
    return f"---\n{header}\n---\n{body}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / ".local" / "skill-packages")
    args = parser.parse_args()
    source = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    linked = set(re.findall(r"\]\((references/[^)]+\.md)\)", source))
    if linked != set(REFERENCES):
        raise SystemExit("SKILL.md references must match the package allowlist.")

    files = {path: (SKILL / path).read_bytes() for path in REFERENCES}
    files["LICENSE"] = (ROOT / "LICENSE").read_bytes()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for target, entrypoint in (("standard", source), ("workbuddy", workbuddy_entrypoint(source))):
        archive_path = args.output_dir / f"{NAME}-{target}.zip"
        with ZipFile(archive_path, "w", ZIP_DEFLATED) as archive:
            archive.writestr(f"{NAME}/SKILL.md", entrypoint.encode("utf-8"))
            for path, content in files.items():
                archive.writestr(f"{NAME}/{path}", content)
        print(archive_path.resolve())


if __name__ == "__main__":
    main()
