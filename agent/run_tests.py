#!/usr/bin/env python3
"""Zero-dependency test runner for the Assay decision engine.

Reviewers can verify the crown-jewel VoI engine without installing pytest:

    ./.venv/bin/python agent/run_tests.py

It discovers every ``test_*`` function in ``agent/tests/`` and runs it,
printing a PASS/FAIL line per test and exiting non-zero if anything fails.
"""
from __future__ import annotations

import importlib.util
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
TESTS_DIR = os.path.join(HERE, "tests")

# Make the ``assay`` package importable when run from anywhere.
if HERE not in sys.path:
    sys.path.insert(0, HERE)


def _load_module(path: str):
    name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def main() -> int:
    test_files = sorted(
        os.path.join(TESTS_DIR, f)
        for f in os.listdir(TESTS_DIR)
        if f.startswith("test_") and f.endswith(".py")
    )
    if not test_files:
        print("no test files found in", TESTS_DIR)
        return 1

    passed = failed = 0
    for path in test_files:
        module = _load_module(path)
        tests = sorted(n for n in dir(module) if n.startswith("test_"))
        for name in tests:
            try:
                getattr(module, name)()
                print(f"PASS  {name}")
                passed += 1
            except Exception:  # noqa: BLE001 - surface the full failure
                print(f"FAIL  {name}")
                traceback.print_exc()
                failed += 1

    print(f"\n{passed} passed, {failed} failed of {passed + failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
