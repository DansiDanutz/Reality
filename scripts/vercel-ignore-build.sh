#!/bin/bash
# Vercel ignoreCommand — exit 0 skips the build, exit 1 proceeds.
#
# Production always builds. Preview builds are skipped for pipeline-internal
# branches (codex/*, automation/*): those PRs are gated by the CI `verify`
# check and typically merge within a minute, while their preview builds queue
# for 10+ minutes and starve the shared deploy queue. Previews stay enabled
# for claude/* and human branches, where visual review matters.

if [ "$VERCEL_ENV" = "production" ]; then
  exit 1
fi

case "$VERCEL_GIT_COMMIT_REF" in
  codex/* | automation/*)
    echo "Skipping preview build for pipeline branch: $VERCEL_GIT_COMMIT_REF"
    exit 0
    ;;
esac

exit 1
