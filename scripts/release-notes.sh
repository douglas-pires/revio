#!/bin/bash
# The release notes for a range of commits, like v0.3.0..HEAD: a line per merged pull request, newest first, with its
# title and number ("- feat: copy the branch name (#52)"), then commits pushed without one.
# A merge commit's body is the pull request's title (a repository setting); a squashed one's title ends in its number.
set -euo pipefail

range=$1

git log --merges --format='%s|~|%b' "$range" |
  sed -nE \
    -e 's/^Merge pull request #([0-9]+) from [^ ]+\|~\|(.+)$/- \2 (#\1)/p' \
    -e 's/^Merge pull request #([0-9]+) from [^ ]+\|~\|$/- Pull request (#\1)/p'

git log --first-parent --no-merges --format='- %s' "$range"
