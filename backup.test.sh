#!/bin/bash
# Unit tests for the rotate_backups function in backup.sh.
# Run directly: ./backup.test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup.sh"
set +e # backup.sh's `set -e` leaks into this shell via source; this file only wants -uo pipefail

FAILURES=0

# Creates a fake backup file aged $2 days old inside dir $1.
make_backup() {
    local dir="$1"
    local age_days="$2"
    local name="$3"
    local file="$dir/$name"
    touch "$file"
    local past
    past=$(date -v-"${age_days}"d +%Y%m%d%H%M 2>/dev/null || date -d "-${age_days} days" +%Y%m%d%H%M)
    touch -t "$past" "$file"
}

assert_count() {
    local dir="$1"
    local expected="$2"
    local label="$3"
    local actual
    actual=$(ls -1 "$dir"/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$actual" != "$expected" ]; then
        echo "FAIL: $label (expected $expected files, got $actual)"
        FAILURES=$((FAILURES + 1))
    else
        echo "PASS: $label"
    fi
}

# A gap longer than KEEP_DAYS must not drop the archive below MIN_KEEP.
test_gap_does_not_breach_floor() {
    local dir
    dir=$(mktemp -d)
    make_backup "$dir" 45 "db_backup_old.sql.gz"
    make_backup "$dir" 0 "db_backup_new.sql.gz"

    rotate_backups "$dir" 30 7 > /dev/null
    assert_count "$dir" 2 "gap longer than KEEP_DAYS keeps everything under the MIN_KEEP floor"

    rm -rf "$dir"
}

# Beyond the floor, age-based pruning still applies.
test_prunes_beyond_floor_by_age() {
    local dir
    dir=$(mktemp -d)
    for i in 1 2 3; do
        make_backup "$dir" 0 "db_backup_recent_$i.sql.gz"
    done
    make_backup "$dir" 45 "db_backup_ancient.sql.gz"

    rotate_backups "$dir" 30 3 > /dev/null
    assert_count "$dir" 3 "old dump beyond the floor is pruned"

    rm -rf "$dir"
}

# A dump beyond the floor but within the age cutoff survives.
test_keeps_recent_beyond_floor() {
    local dir
    dir=$(mktemp -d)
    for i in 1 2 3; do
        make_backup "$dir" 0 "db_backup_recent_$i.sql.gz"
    done
    make_backup "$dir" 10 "db_backup_within_window.sql.gz"

    rotate_backups "$dir" 30 3 > /dev/null
    assert_count "$dir" 4 "dump beyond the floor but within KEEP_DAYS is kept"

    rm -rf "$dir"
}

test_gap_does_not_breach_floor
test_prunes_beyond_floor_by_age
test_keeps_recent_beyond_floor

if [ "$FAILURES" -gt 0 ]; then
    echo "$FAILURES test(s) failed"
    exit 1
fi
echo "All tests passed"
