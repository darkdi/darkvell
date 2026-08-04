#!/usr/bin/env python3
"""Build compact Phaser multi-atlases for the CraftPix pixel enemy pack."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "monsters" / "craftpix-net-339194-free-fantasy-enemies-pixel-art-sprite-pack"
OUTPUT_ROOT = ROOT / "client" / "public" / "assets" / "monsters" / "pixel-v1"
CELL_SIZE = 128
FRAME_PADDING = 2
PAGE_WIDTHS = (256, 384, 512, 640, 768, 896, 1024)


@dataclass(frozen=True)
class PackDefinition:
    pack_id: int
    slug: str
    source_directory: str
    flying: bool
    pivot_y: float
    sequences: dict[str, tuple[str, bool]]


@dataclass(frozen=True)
class Frame:
    name: str
    image: Image.Image
    source_x: int
    source_y: int


PACKS = (
    PackDefinition(
        11,
        "venom-plant",
        "Plent",
        False,
        1.0,
        {
            "idle": ("Idle.png", False),
            "walking": ("Walk.png", False),
            "attack": ("Attack_1.png", False),
            "jump": ("Disguise.png", True),
            "dying": ("Dead.png", False),
        },
    ),
    PackDefinition(
        12,
        "bone-warrior",
        "Skeleton",
        False,
        1.0,
        {
            "idle": ("Idle.png", False),
            "walking": ("Walk.png", False),
            "attack": ("Attack_1.png", False),
            "jump": ("Jump.png", False),
            "dying": ("Dead.png", False),
        },
    ),
    PackDefinition(
        13,
        "fire-spirit",
        "Fire_Spirit",
        True,
        0.75,
        {
            "idle": ("Idle.png", False),
            "fly": ("Run.png", False),
            "attack": ("Attack.png", False),
            "fall": ("Explosion.png", False),
            "dying": ("Dead.png", False),
        },
    ),
)


def read_frames(path: Path, sequence: str, reverse: bool) -> list[Frame]:
    with Image.open(path) as source:
        sheet = source.convert("RGBA")
    if sheet.height != CELL_SIZE or sheet.width % CELL_SIZE != 0:
        raise RuntimeError(f"Expected a horizontal 128px-cell sheet: {path} ({sheet.size})")
    cells = [sheet.crop((index * CELL_SIZE, 0, (index + 1) * CELL_SIZE, CELL_SIZE)) for index in range(sheet.width // CELL_SIZE)]
    if reverse:
        cells.reverse()
    frames: list[Frame] = []
    for index, cell in enumerate(cells):
        bbox = cell.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError(f"Empty frame {index} in {path}")
        left = max(0, bbox[0] - FRAME_PADDING)
        top = max(0, bbox[1] - FRAME_PADDING)
        right = min(CELL_SIZE, bbox[2] + FRAME_PADDING)
        bottom = min(CELL_SIZE, bbox[3] + FRAME_PADDING)
        frames.append(Frame(f"{sequence}/{index:02d}", cell.crop((left, top, right, bottom)), left, top))
    return frames


def shelf_layout(frames: list[Frame], page_width: int) -> tuple[dict[str, tuple[int, int]], int, int] | None:
    ordered = sorted(frames, key=lambda frame: (-frame.image.height, -frame.image.width, frame.name))
    positions: dict[str, tuple[int, int]] = {}
    x = FRAME_PADDING
    y = FRAME_PADDING
    row_height = 0
    used_width = 0
    for frame in ordered:
        if frame.image.width + FRAME_PADDING * 2 > page_width:
            return None
        if x + frame.image.width + FRAME_PADDING > page_width and x > FRAME_PADDING:
            x = FRAME_PADDING
            y += row_height + FRAME_PADDING
            row_height = 0
        positions[frame.name] = (x, y)
        used_width = max(used_width, x + frame.image.width + FRAME_PADDING)
        row_height = max(row_height, frame.image.height)
        x += frame.image.width + FRAME_PADDING
    used_height = y + row_height + FRAME_PADDING
    return positions, max(1, used_width), max(1, used_height)


def best_layout(frames: list[Frame]) -> tuple[dict[str, tuple[int, int]], int, int]:
    choices: list[tuple[int, int, int, dict[str, tuple[int, int]]]] = []
    for width in PAGE_WIDTHS:
        result = shelf_layout(frames, width)
        if result is None:
            continue
        positions, used_width, used_height = result
        choices.append((used_width * used_height, max(used_width, used_height), used_width, positions | {"__size__": (used_height, 0)}))
    if not choices:
        raise RuntimeError("Could not fit pixel monster frames into an atlas page")
    _, _, width, encoded = min(choices, key=lambda choice: (choice[0], choice[1]))
    height = encoded.pop("__size__")[0]
    return encoded, width, height


def build_page(pack: PackDefinition, sequence: str, frames: list[Frame]) -> tuple[dict[str, object], int]:
    positions, width, height = best_layout(frames)
    page = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    atlas_frames: list[dict[str, object]] = []
    for frame in sorted(frames, key=lambda candidate: candidate.name):
        x, y = positions[frame.name]
        page.alpha_composite(frame.image, (x, y))
        atlas_frames.append(
            {
                "filename": frame.name,
                "frame": {"x": x, "y": y, "w": frame.image.width, "h": frame.image.height},
                "rotated": False,
                "trimmed": True,
                "spriteSourceSize": {
                    "x": frame.source_x,
                    "y": frame.source_y,
                    "w": frame.image.width,
                    "h": frame.image.height,
                },
                "sourceSize": {"w": CELL_SIZE, "h": CELL_SIZE},
                "pivot": {"x": 0.5, "y": pack.pivot_y},
            }
        )
    image_name = f"pixel-monster-{pack.pack_id}-{sequence}.png"
    page.save(OUTPUT_ROOT / image_name, format="PNG", optimize=True, compress_level=9)
    return (
        {
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": width, "h": height},
            "scale": 1,
            "frames": atlas_frames,
        },
        width * height,
    )


def build_pack(pack: PackDefinition) -> dict[str, object]:
    pages: list[dict[str, object]] = []
    decoded_pixels = 0
    frame_counts: dict[str, int] = {}
    for sequence, (filename, reverse) in pack.sequences.items():
        frames = read_frames(SOURCE_ROOT / pack.source_directory / filename, sequence, reverse)
        frame_counts[sequence] = len(frames)
        page, pixels = build_page(pack, sequence, frames)
        pages.append(page)
        decoded_pixels += pixels
    atlas_name = f"pixel-monster-{pack.pack_id}.json"
    (OUTPUT_ROOT / atlas_name).write_text(
        json.dumps(
            {
                "textures": pages,
                "meta": {
                    "app": "DarkVell CraftPix pixel atlas builder",
                    "version": "1.0",
                    "format": "RGBA8888",
                    "scale": "1",
                    "packId": pack.pack_id,
                    "slug": pack.slug,
                },
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    return {
        "atlas": atlas_name,
        "slug": pack.slug,
        "flying": pack.flying,
        "sourceSize": {"w": CELL_SIZE, "h": CELL_SIZE},
        "pivot": {"x": 0.5, "y": pack.pivot_y},
        "frameCounts": frame_counts,
        "decodedMegabytes": round(decoded_pixels * 4 / (1024 * 1024), 2),
    }


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise SystemExit(f"Missing source pack: {SOURCE_ROOT}")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    for existing in OUTPUT_ROOT.glob("pixel-monster-*"):
        existing.unlink()
    manifest = {"version": 1, "source": SOURCE_ROOT.name, "packs": {str(pack.pack_id): build_pack(pack) for pack in PACKS}}
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUTPUT_ROOT / "LICENSE.txt").write_text(
        "Source artwork: Free Fantasy Enemies Pixel Art Sprite Pack by CraftPix.\n"
        "Product: https://craftpix.net/freebies/free-fantasy-enemies-pixel-art-sprite-pack/\n"
        "License: https://craftpix.net/file-licenses/\n"
        "Only optimized runtime atlases are shipped; editable sources are not redistributed.\n",
        encoding="utf-8",
    )
    png_bytes = sum(path.stat().st_size for path in OUTPUT_ROOT.glob("*.png"))
    decoded_mb = sum(pack["decodedMegabytes"] for pack in manifest["packs"].values())
    print(f"Built {len(PACKS)} pixel monster multi-atlases in {OUTPUT_ROOT}")
    print(f"PNG transfer size: {png_bytes / 1024:.1f} KiB")
    print(f"Estimated decoded atlas memory: {decoded_mb:.2f} MiB")


if __name__ == "__main__":
    main()
