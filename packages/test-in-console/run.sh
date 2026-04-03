#!/usr/bin/env bash

# from Meteor local checkout run like
# ./packages/test-in-console/run.sh
# or for a specific package
# ./packages/test-in-console/run.sh "mongo"

cd $(dirname $0)/../..
export METEOR_HOME=`pwd`

# Install puppeteer into dev_bundle only when it is not already available globally
# (e.g. on oss-vm, where puppeteer@23.6.0 is pre-installed via system npm and
# NODE_PATH is set to $(npm root -g) by the CI workflow).
if ! node -e "require('./dev_bundle/lib/node_modules/puppeteer')" 2>/dev/null && \
   ! node -e "require('puppeteer')" 2>/dev/null; then
  ./meteor npm install -g puppeteer@23.6.0
fi

export PATH=$METEOR_HOME:$PATH

# Pick a port that is unique per concurrent runner on the same host so that
# multiple matrix jobs running simultaneously on one machine do not collide.
# We derive an offset from the runner name (e.g. "actions-runner20" → 20) and
# add it to the base port 4096.  When no runner number is present (local runs)
# the offset is 0, so the default 4096 is used unchanged.
_RUNNER_NUM=$(echo "${RUNNER_NAME:-}" | tr -dc '0-9' | sed 's/^0*//')
_PORT=$(( 4096 + ${_RUNNER_NUM:-0} ))
export URL="http://127.0.0.1:$_PORT/"
export METEOR_PACKAGE_DIRS='packages/deprecated'

# --- Hosted CI mode ---
# Set METEOR_HOSTED_CI=true to automatically apply CI environment settings and
# exclude Blaze packages (maintained separately at github.com/meteor/blaze)
# and all packages under packages/deprecated/.
if [ "${METEOR_HOSTED_CI:-}" = "true" ]; then
  echo "running in hosted CI mode: excluding Blaze and deprecated packages from test run"
  export METEOR_MODERN="${METEOR_MODERN:-true}"
  export NODE_ENV="${NODE_ENV:-CI}"
  export METEOR_HEADLESS="${METEOR_HEADLESS:-true}"

  # Blaze packages — maintained at github.com/meteor/blaze
  _BLAZE="blaze,blaze-hot,blaze-html-templates,blaze-tools,caching-html-compiler,html-tools,htmljs,observe-sequence,spacebars,spacebars-compiler,spacebars-tests,templating,templating-compiler,templating-runtime,templating-tools,ui"
  # Packages in packages/deprecated/ — kept for backwards compatibility only
  _DEPRECATED="amplify,appcache,backbone,code-prettify,context,d3,deps,facebook,facts,fastclick,github,google,handlebars,http,jquery-history,jquery-layout,jquery-waypoints,jsparse,jshint,livedata,markdown,meetup,meteor-developer,meteor-platform,meyerweb-reset,npm-bcrypt,preserve-inputs,showdown,spiderable,srp,standard-app-packages,startup,stylus,twitter,underscore,underscore-tests,weibo"

  export TEST_PACKAGES_EXCLUDE="${TEST_PACKAGES_EXCLUDE:+${TEST_PACKAGES_EXCLUDE},}${_BLAZE},${_DEPRECATED}"
fi

# Merge stderr into stdout so all Meteor output is captured on fd3.
# This ensures crash messages (which go to stderr) are visible when sed
# exits on EOF, rather than being silently discarded.
exec 3< <(./meteor test-packages --driver-package test-in-console -p "$_PORT" --exclude ${TEST_PACKAGES_EXCLUDE:-''} "$@" 2>&1)
EXEC_PID=$!
trap "pkill -TERM -P $EXEC_PID; exit 1" SIGINT

# Print everything Meteor outputs until it signals it is ready.
# If Meteor crashes before printing "test-in-console listening", sed exits on
# EOF.  We then check whether the process is still alive and fail loudly so
# the CI log shows the actual crash output rather than a misleading
# ERR_CONNECTION_REFUSED from Puppeteer.
sed '/test-in-console listening$/q' <&3

if ! kill -0 "$EXEC_PID" 2>/dev/null; then
  echo "" >&2
  echo "error: meteor test-packages exited before the server started listening on port $_PORT." >&2
  echo "Check the output above for the actual crash reason." >&2
  pkill -TERM -P $EXEC_PID 2>/dev/null || true
  exit 1
fi

node --trace-warnings "$METEOR_HOME/packages/test-in-console/puppeteer_runner.js"

STATUS=$?

pkill -TERM -P $EXEC_PID
exit $STATUS
