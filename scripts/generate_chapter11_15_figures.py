"""Compatibility entry point for old chapter 11-15 figure generation.

The publishable chapters now use the focused per-chapter scripts:

- scripts/generate_chapter11_figures.py
- scripts/generate_chapter12_figures.py
- scripts/generate_chapter13_figures.py
- scripts/generate_chapter14_figures.py
- scripts/generate_chapter15_figures.py

Keep this file non-destructive so running an old command does not recreate
retired process-card figures.
"""

from __future__ import annotations


def main() -> None:
    print("chapter 11-15 figures have moved to per-chapter scripts")


if __name__ == "__main__":
    main()
