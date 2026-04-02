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

export LISTENING_PORT=${LISTENING_PORT:-4096}
export URL="http://127.0.0.1:${LISTENING_PORT}/"
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

exec 3< <(./meteor test-packages --driver-package test-in-console -p $LISTENING_PORT --exclude ${TEST_PACKAGES_EXCLUDE:-''} "$@")
EXEC_PID=$!
trap "pkill -TERM -P $EXEC_PID; exit 1" SIGINT

sed '/test-in-console listening$/q' <&3

node --trace-warnings "$METEOR_HOME/packages/test-in-console/puppeteer_runner.js"

STATUS=$?

pkill -TERM -P $EXEC_PID
exit $STATUS
