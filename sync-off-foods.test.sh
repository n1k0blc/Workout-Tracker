#!/bin/bash
# Unit tests for the marker handling in sync-off-foods.sh.
# Run directly: ./sync-off-foods.test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/sync-off-foods.sh"
set +e # sync-off-foods.sh's `set -e` leaks into this shell via source

FAILURES=0

assert_equals() {
    local actual="$1"
    local expected="$2"
    local label="$3"
    if [ "$actual" != "$expected" ]; then
        echo "FAIL: $label (expected '$expected', got '$actual')"
        FAILURES=$((FAILURES + 1))
    else
        echo "PASS: $label"
    fi
}

# A missing marker file is the first run, not a failure: the sync falls back to lastSyncedAt.
test_missing_marker_file() {
    assert_equals "$(read_marker /nonexistent/off-sync.state)" "" "missing marker file reads as empty"
}

# Half-written or hand-edited files must not be passed to --since as garbage.
test_corrupt_marker_file() {
    local dir
    dir=$(mktemp -d)
    echo "not-a-timestamp" >"$dir/state"
    assert_equals "$(read_marker "$dir/state")" "" "non-numeric marker reads as empty"
    printf '1788934590\n' >"$dir/state"
    assert_equals "$(read_marker "$dir/state")" "1788934590" "a written marker reads back"
    rm -rf "$dir"
}

# The marker is the sync's last line, printed after a wall of funnel counts.
test_extract_marker() {
    local output="📋 products 6,204
   importable: 434
✅ 12 created, 402 updated, 20 skipped, in 96s.
off-sync-marker 1788934590"
    assert_equals "$(extract_marker <<<"$output")" "1788934590" "marker read out of a full run"
    assert_equals "$(extract_marker <<<"✅ Dry run finished in 88s.")" "" "a dry run reports no marker"
    assert_equals "$(extract_marker <<<"off-sync-marker later today")" "" "a non-numeric marker is ignored"
}

# The wrapper's whole job: run the sync in the container, then advance the marker -- but only
# when the run actually succeeded. `docker` is shadowed by a function here, so no container is
# needed and main() takes its normal path.
test_main_advances_the_marker() {
    local dir
    dir=$(mktemp -d)
    STATE_FILE="$dir/state"
    echo "1788847691" >"$STATE_FILE"
    docker() {
        echo "--- docker $* ---"
        echo "✅ 12 created, 402 updated, 20 skipped, in 96s."
        echo "off-sync-marker 1788934590"
    }

    local output
    output=$(main 2>&1)

    assert_equals "$(cat "$STATE_FILE")" "1788934590" "a successful run advances the marker"
    case "$output" in
        *"--since 1788847691"*) echo "PASS: the stored marker is passed as --since" ;;
        *)
            echo "FAIL: the stored marker is passed as --since (got: $output)"
            FAILURES=$((FAILURES + 1))
            ;;
    esac
    unset -f docker
    rm -rf "$dir"
}

test_main_keeps_the_marker_on_failure() {
    local dir
    dir=$(mktemp -d)
    STATE_FILE="$dir/state"
    echo "1788847691" >"$STATE_FILE"
    docker() {
        echo "❌ Delta sync failed: GET .../index.txt answered 503"
        return 1
    }

    (main >/dev/null 2>&1)
    assert_equals "$?" "1" "a failed run exits non-zero"
    assert_equals "$(cat "$STATE_FILE")" "1788847691" "a failed run leaves the marker alone"

    unset -f docker
    rm -rf "$dir"
}

# A dry run reports counts and prints no marker, so there is nothing to write back.
test_main_dry_run_leaves_the_marker() {
    local dir
    dir=$(mktemp -d)
    STATE_FILE="$dir/state"
    echo "1788847691" >"$STATE_FILE"
    docker() {
        echo "✅ Dry run finished in 88s. Nothing was written."
    }

    main --dry-run >/dev/null 2>&1
    assert_equals "$(cat "$STATE_FILE")" "1788847691" "a dry run leaves the marker alone"

    unset -f docker
    rm -rf "$dir"
}

test_missing_marker_file
test_corrupt_marker_file
test_extract_marker
test_main_advances_the_marker
test_main_keeps_the_marker_on_failure
test_main_dry_run_leaves_the_marker

if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES test(s) failed"
    exit 1
fi
echo "All tests passed"
