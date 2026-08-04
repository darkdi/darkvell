#!/usr/bin/env python3
"""Build compact Phaser 3 multi-atlases from the CraftPix monster PNG sequences."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "monsters"
OUTPUT_ROOT = ROOT / "client" / "public" / "assets" / "monsters" / "v1"
FRAME_RATE = 30
FRAME_DURATION_MS = 600
FRAME_PADDING = 2
UNION_PADDING = 4
MIN_FRAME_MAX_DIMENSION = 180
BASE_SCALE = 0.5
ATLAS_WIDTH_CANDIDATES = (512, 640, 768, 896, 1024, 1152, 1280, 1536)


@dataclass(frozen=True)
class PackedFrame:
    filename: str
    image: Image.Image
    source_width: int
    source_height: int
    source_x: int
    source_y: int
    pivot_x: float
    pivot_y: float


def sequence_directories(monster_dir: Path) -> list[Path]:
    root = monster_dir / "PNG" / "PNG Sequences"
    return sorted((entry for entry in root.iterdir() if entry.is_dir()), key=lambda entry: entry.name.lower())


def frame_paths(sequence_dir: Path) -> list[Path]:
    paths = sorted(sequence_dir.glob("*.png"))
    if len(paths) != 18:
        raise RuntimeError(f"Expected 18 frames in {sequence_dir}, found {len(paths)}")
    return paths


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def union_bbox(paths: Iterable[Path]) -> tuple[tuple[int, int, int, int], tuple[int, int]]:
    bounds: tuple[int, int, int, int] | None = None
    source_size: tuple[int, int] | None = None
    for path in paths:
        with Image.open(path) as source:
            image = source.convert("RGBA")
            if source_size is None:
                source_size = image.size
            elif image.size != source_size:
                raise RuntimeError(f"Mismatched frame size in {path}: {image.size} != {source_size}")
            bbox = alpha_bbox(image)
            if bbox is None:
                continue
            if bounds is None:
                bounds = bbox
            else:
                bounds = (
                    min(bounds[0], bbox[0]),
                    min(bounds[1], bbox[1]),
                    max(bounds[2], bbox[2]),
                    max(bounds[3], bbox[3]),
                )
    if bounds is None or source_size is None:
        raise RuntimeError("Monster sequence contains no visible pixels")
    left = max(0, bounds[0] - UNION_PADDING)
    top = max(0, bounds[1] - UNION_PADDING)
    right = min(source_size[0], bounds[2] + UNION_PADDING)
    bottom = min(source_size[1], bounds[3] + UNION_PADDING)
    return (left, top, right, bottom), source_size


def scaled_source_geometry(
    crop: tuple[int, int, int, int], source_size: tuple[int, int]
) -> tuple[int, int, float, float, float]:
    left, top, right, bottom = crop
    crop_width = right - left
    crop_height = bottom - top
    adaptive_scale = MIN_FRAME_MAX_DIMENSION / max(crop_width, crop_height)
    scale = min(1.0, max(BASE_SCALE, adaptive_scale))
    width = max(1, round(crop_width * scale))
    height = max(1, round(crop_height * scale))
    pivot_x = (source_size[0] * 0.5 - left) / crop_width
    pivot_y = (source_size[1] * 0.5 - top) / crop_height
    return width, height, pivot_x, pivot_y, scale


def build_frame(
    path: Path,
    frame_name: str,
    crop: tuple[int, int, int, int],
    source_width: int,
    source_height: int,
    pivot_x: float,
    pivot_y: float,
) -> PackedFrame:
    with Image.open(path) as source:
        image = source.convert("RGBA").crop(crop)
    image = image.resize((source_width, source_height), Image.Resampling.LANCZOS)
    bbox = alpha_bbox(image)
    if bbox is None:
        bbox = (0, 0, 1, 1)
    left = max(0, bbox[0] - FRAME_PADDING)
    top = max(0, bbox[1] - FRAME_PADDING)
    right = min(source_width, bbox[2] + FRAME_PADDING)
    bottom = min(source_height, bbox[3] + FRAME_PADDING)
    return PackedFrame(
        filename=frame_name,
        image=image.crop((left, top, right, bottom)),
        source_width=source_width,
        source_height=source_height,
        source_x=left,
        source_y=top,
        pivot_x=pivot_x,
        pivot_y=pivot_y,
    )


def shelf_layout(frames: list[PackedFrame], width: int) -> tuple[dict[str, tuple[int, int]], int, int] | None:
    ordered = sorted(frames, key=lambda frame: (-frame.image.height, -frame.image.width, frame.filename))
    positions: dict[str, tuple[int, int]] = {}
    x = FRAME_PADDING
    y = FRAME_PADDING
    row_height = 0
    used_width = 0
    for packed in ordered:
        frame_width = packed.image.width
        frame_height = packed.image.height
        if frame_width + FRAME_PADDING * 2 > width:
            return None
        if x + frame_width + FRAME_PADDING > width and x > FRAME_PADDING:
            x = FRAME_PADDING
            y += row_height + FRAME_PADDING
            row_height = 0
        positions[packed.filename] = (x, y)
        used_width = max(used_width, x + frame_width + FRAME_PADDING)
        row_height = max(row_height, frame_height)
        x += frame_width + FRAME_PADDING
    used_height = y + row_height + FRAME_PADDING
    if used_height > 2048:
        return None
    return positions, max(1, used_width), max(1, used_height)


def best_layout(frames: list[PackedFrame]) -> tuple[dict[str, tuple[int, int]], int, int]:
    choices: list[tuple[int, int, int, dict[str, tuple[int, int]]]] = []
    for candidate_width in ATLAS_WIDTH_CANDIDATES:
        result = shelf_layout(frames, candidate_width)
        if result is None:
            continue
        positions, width, height = result
        area = width * height
        longest_side = max(width, height)
        choices.append((area, longest_side, width, positions | {"__height__": (height, 0)}))
    if not choices:
        raise RuntimeError("Could not pack sequence into a 2048px atlas page")
    _, _, width, encoded = min(choices, key=lambda entry: (entry[0], entry[1]))
    height = encoded.pop("__height__")[0]
    return encoded, width, height


def build_page(monster_number: int, action: str, frames: list[PackedFrame]) -> tuple[dict[str, object], int]:
    positions, width, height = best_layout(frames)
    atlas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    json_frames: list[dict[str, object]] = []
    for packed in sorted(frames, key=lambda frame: frame.filename):
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
                "pivot": {"x": round(packed.pivot_x, 6), "y": round(packed.pivot_y, 6)},
            }
        )
    image_name = f"monster-{monster_number}-{action.lower()}.png"
    atlas.save(OUTPUT_ROOT / image_name, format="PNG", optimize=True, compress_level=9)
    return (
        {
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            "scale": 1,
            "frames": json_frames,
        },
        width * height,
    )


def build_monster(monster_number: int) -> dict[str, object]:
    monster_dir = SOURCE_ROOT / f"Monster_{monster_number}"
    sequences = sequence_directories(monster_dir)
    all_paths = [path for sequence in sequences for path in frame_paths(sequence)]
    crop, raw_source_size = union_bbox(all_paths)
    source_width, source_height, pivot_x, pivot_y, scale = scaled_source_geometry(crop, raw_source_size)
    pages: list[dict[str, object]] = []
    decoded_pixels = 0
    sequence_names: list[str] = []
    for sequence in sequences:
        action = sequence.name.lower()
        sequence_names.append(action)
        frames = [
            build_frame(
                path,
                f"{action}/{index:02d}",
                crop,
                source_width,
                source_height,
                pivot_x,
                pivot_y,
            )
            for index, path in enumerate(frame_paths(sequence))
        ]
        page, page_pixels = build_page(monster_number, action, frames)
        pages.append(page)
        decoded_pixels += page_pixels
    atlas_json = {
        "textures": pages,
        "meta": {
            "app": "DarkVell monster atlas builder",
            "version": "1.0",
            "format": "RGBA8888",
            "scale": "1",
            "monster": monster_number,
            "fps": FRAME_RATE,
            "durationMs": FRAME_DURATION_MS,
        },
    }
    json_path = OUTPUT_ROOT / f"monster-{monster_number}.json"
    json_path.write_text(json.dumps(atlas_json, separators=(",", ":")), encoding="utf-8")
    return {
        "atlas": json_path.name,
        "sourceSize": {"w": source_width, "h": source_height},
        "pivot": {"x": round(pivot_x, 6), "y": round(pivot_y, 6)},
        "scale": round(scale, 6),
        "flying": "fly" in sequence_names,
        "sequences": sequence_names,
        "decodedMegabytes": round(decoded_pixels * 4 / (1024 * 1024), 2),
    }


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise SystemExit(f"Missing monster source directory: {SOURCE_ROOT}")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "version": 1,
        "fps": FRAME_RATE,
        "durationMs": FRAME_DURATION_MS,
        "packs": {str(number): build_monster(number) for number in range(1, 11)},
    }
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_ROOT / "LICENSE.txt").write_text(
        "Source artwork: CraftPix monster packs provided by the project owner.\n"
        "License reference included with the source packs: https://craftpix.net/file-licenses/\n",
        encoding="utf-8",
    )
    png_bytes = sum(path.stat().st_size for path in OUTPUT_ROOT.glob("*.png"))
    decoded_mb = sum(pack["decodedMegabytes"] for pack in manifest["packs"].values())
    print(f"Built 10 monster multi-atlases in {OUTPUT_ROOT}")
    print(f"PNG transfer size: {png_bytes / (1024 * 1024):.2f} MiB")
    print(f"Estimated decoded atlas memory: {decoded_mb:.2f} MiB")


if __name__ == "__main__":
    main()
