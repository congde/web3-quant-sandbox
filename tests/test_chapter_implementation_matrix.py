from __future__ import annotations

from scripts.chapter_implementation_matrix import MATRIX, ROOT, validate_matrix


def test_all_publishable_chapters_have_code_and_test_coverage() -> None:
    assert validate_matrix() == []
    assert [item.chapter for item in MATRIX] == list(range(36))


def test_web_chapters_expose_reader_routes() -> None:
    route_chapters = {23, 24, 25, 26, 27, 33, 34}
    for item in MATRIX:
        if item.chapter in route_chapters:
            assert item.routes, f"chapter {item.chapter:02d} must expose web routes"


def test_matrix_is_bound_to_product_code_not_vendor_only() -> None:
    for item in MATRIX:
        joined = " ".join(item.code_paths)
        assert (
            "src/" in joined
            or "scripts/" in joined
            or "skills/" in joined
            or "verify.py" in joined
        )
        assert not all(path.startswith("vendor/") for path in item.code_paths)


def test_matrix_references_real_test_files() -> None:
    for item in MATRIX:
        for test_path in item.test_paths:
            assert test_path.startswith("tests/")
            assert (ROOT / test_path).is_file()
