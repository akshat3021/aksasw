"""
Test runner for backend unit tests.
Discovers and runs test files matching test_*.py.
Supports both pytest (if installed) and built-in runner.
"""

import importlib
import inspect
import os
import sys
import traceback

# Ensure backend root is on sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


def run_tests() -> int:
    try:
        import pytest
        print("Running tests with pytest...", flush=True)
        return pytest.main(["-v", os.path.join(BASE_DIR, "tests")])
    except ImportError:
        print("pytest not installed; using built-in test runner...", flush=True)

    tests_dir = os.path.join(BASE_DIR, "tests")
    test_files = [f[:-3] for f in sorted(os.listdir(tests_dir)) if f.startswith("test_") and f.endswith(".py")]

    total = 0
    passed = 0
    failed = 0

    print(f"Discovered test modules: {test_files}\n" + "=" * 60, flush=True)

    for mod_name in test_files:
        try:
            mod = importlib.import_module(f"tests.{mod_name}")
        except Exception as e:
            print(f"ERROR importing {mod_name}: {e}", flush=True)
            traceback.print_exc()
            failed += 1
            continue

        for attr_name in dir(mod):
            if attr_name.startswith("test_"):
                fn = getattr(mod, attr_name)
                if callable(fn):
                    total += 1
                    try:
                        fn()
                        print(f"  [PASS] {mod_name}.{attr_name}", flush=True)
                        passed += 1
                    except Exception as e:
                        print(f"  [FAIL] {mod_name}.{attr_name}: {e}", flush=True)
                        traceback.print_exc()
                        failed += 1

    print("=" * 60, flush=True)
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_tests())
