#!/usr/bin/env python3
"""Pack the local CraftPix tree and bush PNGs into one compact Phaser atlas."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
TREE_ROOT = ROOT / "world" / "craftpix-net-168228-free-tree-pixel-art-asset-pack" / "PNG"
BUSH_ROOT = ROOT / "world" / "craftpix-net-699134-free-bush-assets-pixel-art-pack" / "PNG"
OUTPUT_ROOT = ROOT / "client" / "public" / "assets" / "world" / "foliage-v1"
PADDING = 2
MAX_ATLAS_SIDE = 2048
WIDTH_CANDIDATES = (1024, 1152, 1280, 1408, 1536, 1792, 2048)


@dataclass(frozen=True)
class SourceFrame:
    filename: str
    path: Path


@dataclass(frozen=True)
class PackedFrame:
    filename: str
    image: Image.Image
    source_width: int
    source_height: int
    source_x: int
    source_y: int


def tree_frame_name(path: Path) -> str:
    stem = path.stem
    middle_match = re.fullmatch(r"middle_lane_tree(\d+)", stem)
    if middle_match:
        return f"tree/middle/{int(middle_match.group(1))}"
    family, number = stem.rsplit("_", 1)
    family = {
        "birch": "birch",
        "fir_tree": "fir",
        "jungle_tree": "jungle",
        "winter_conifer_tree": "winter-conifer",
        "winter_tree": "winter-bare",
    }[family]
    return f"tree/{family}/{int(number)}"


def bush_frame_name(path: Path) -> str:
    family, size = path.stem.removeprefix("Bush").split("_", 1)
    return f"bush/{int(family)}/{int(size)}"


def source_frames() -> list[SourceFrame]:
    trees = [SourceFrame(tree_frame_name(path), path) for path in sorted(TREE_ROOT.glob("*.png"))]
    bushes = [SourceFrame(bush_frame_name(path), path) for path in sorted(BUSH_ROOT.glob("Bushes*/*.png"))]
    frames = trees + bushes
    if len(trees) != 70 or len(bushes) != 40:
        raise RuntimeError(f"Expected 70 tree and 40 bush PNGs, found {len(trees)} and {len(bushes)}")
    if len({frame.filename for frame in frames}) != len(frames):
        raise RuntimeError("Normalized foliage frame names are not unique")
    return frames


def trim_frame(source: SourceFrame) -> PackedFrame:
    with Image.open(source.path) as raw:
        image = raw.convert("RGBA")
    source_width, source_height = image.size
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"Foliage frame has no visible pixels: {source.path}")
    left = max(0, bbox[0] - PADDING)
    top = max(0, bbox[1] - PADDING)
    right = min(source_width, bbox[2] + PADDING)
    bottom = min(source_height, bbox[3] + PADDING)
    return PackedFrame(
        filename=source.filename,
        image=image.crop((left, top, right, bottom)),
        source_width=source_width,
        source_height=source_height,
        source_x=left,
        source_y=top,
    )


def shelf_layout(frames: list[PackedFrame], width: int) -> tuple[dict[str, tuple[int, int]], int, int] | None:
    ordered = sorted(frames, key=lambda frame: (-frame.image.height, -frame.image.width, frame.filename))
    positions: dict[str, tuple[int, int]] = {}
    x = PADDING
    y = PADDING
    row_height = 0
    used_width = 0
    for packed in ordered:
        frame_width, frame_height = packed.image.size
        if frame_width + PADDING * 2 > width:
            return None
        if x + frame_width + PADDING > width and x > PADDING:
            x = PADDING
            y += row_height + PADDING
            row_height = 0
        positions[packed.filename] = (x, y)
        used_width = max(used_width, x + frame_width + PADDING)
        row_height = max(row_height, frame_height)
        x += frame_width + PADDING
    used_height = y + row_height + PADDING
    if used_height > MAX_ATLAS_SIDE:
        return None
    return positions, used_width, used_height


def best_layout(frames: list[PackedFrame]) -> tuple[dict[str, tuple[int, int]], int, int]:
    choices: list[tuple[int, int, int, int, dict[str, tuple[int, int]]]] = []
    for candidate_width in WIDTH_CANDIDATES:
        result = shelf_layout(frames, candidate_width)
        if result is None:
            continue
        positions, width, height = result
        choices.append((width * height, max(width, height), width, height, positions))
    if not choices:
        raise RuntimeError("Could not pack foliage into one 2048px atlas page")
    _, _, width, height, positions = min(choices, key=lambda entry: (entry[0], entry[1]))
    return positions, width, height


def main() -> None:
    packed_frames = [trim_frame(source) for source in source_frames()]
    positions, width, height = best_layout(packed_frames)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    json_frames: list[dict[str, object]] = []
    for packed in sorted(packed_frames, key=lambda frame: frame.filename):
        x, y = positions[packed.filename]
        atlas.alpha_composite(packed.image, (x, y))
        json_frames.append(
            {
                "filename": packed.filename,
                "frame": {"x": x, "y": y, "w": packed.image.width, "h": packed.image.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {
                    "x": packed.source_x,
                    "y": packed.source_y,
                    "w": packed.image.width,
                    "h": packed.image.height,
                },
                "sourceSize": {"w": packed.source_width, "h": packed.source_height},
                "pivot": {"x": 0.5, "y": 1.0},
            }
        )

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    image_name = "foliage.png"
    atlas.save(OUTPUT_ROOT / image_name, format="PNG", optimize=True, compress_level=9)
    payload = {
        "textures": [
            {
                "image": image_name,
                "format": "RGBA8888",
                "size": {"w": width, "h": height},
                "scale": 1,
                "frames": json_frames,
            }
        ],
        "meta": {
            "app": "DarkVell world foliage atlas builder",
            "version": "1.0",
            "format": "RGBA8888",
            "scale": 1,
        },
    }
    (OUTPUT_ROOT / "foliage.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_ROOT / "LICENSE.txt").write_text(
        "CraftPix free asset packs used by this atlas:\n"
        "- Free Tree Pixel Art Asset Pack\n"
        "  https://craftpix.net/freebies/free-tree-pixel-art-asset-pack/\n"
        "- Free Bush Assets Pixel Art Pack\n"
        "  https://craftpix.net/freebies/free-bush-assets-pixel-art-pack/\n\n"
        "License reference included with both downloaded packs:\n"
        "https://craftpix.net/file-licenses/\n",
        encoding="utf-8",
    )
    print(f"Built {len(packed_frames)} foliage frames in {width}x{height}: {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
