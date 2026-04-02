FROM ubuntu:22.04

LABEL org.opencontainers.image.description="Meteor package test runner (test-in-console)"

ARG DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC \
    LANG=C.UTF-8

# ── System build tools + Chrome system libraries ───────────────────────────────
#
#   • g++-12            — compile native Node.js add-ons (e.g. fibers)
#   • build-essential   — make, gcc, etc. required by node-gyp
#   • The font/lib entries are Chrome's runtime dependencies.
#     Ubuntu 22.04 ships Chromium as a snap, which cannot run inside a container,
#     so we install Google Chrome Stable from the official Google apt repository
#     in the next layer instead.
#
RUN apt-get update && apt-get install -y --no-install-recommends \
        # toolchain
        g++-12 \
        build-essential \
        python3 \
        make \
        curl \
        git \
        ca-certificates \
        gnupg \
        # Chrome runtime library dependencies
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcups2 \
        libdrm2 \
        libgbm1 \
        libnspr4 \
        libnss3 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        libxss1 \
        libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# ── Google Chrome Stable ───────────────────────────────────────────────────────
#
#   Pulled from Google's official apt repository so the version is always
#   recent enough to be compatible with the pinned puppeteer release, and
#   because the standard Ubuntu 22.04 chromium-browser package is a snap
#   wrapper that does not work inside Docker containers.
#
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
      | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
        http://dl.google.com/linux/chrome/deb/ stable main" \
      > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20.x ──────────────────────────────────────────────────────────────
#
#   Required to run `npm install -g puppeteer` at image build time and to
#   bootstrap Meteor's dev_bundle on first run.
#
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Puppeteer (global) ─────────────────────────────────────────────────────────
#
#   • PUPPETEER_SKIP_CHROMIUM_DOWNLOAD — avoid pulling a second Chrome binary;
#     we use the Google Chrome installation from the previous layer instead.
#   • PUPPETEER_EXECUTABLE_PATH        — point the puppeteer library at that binary.
#   • NODE_PATH                        — make `require('puppeteer')` resolve to the
#     global install from anywhere inside the mounted workspace, so run.sh skips
#     the slow `./meteor npm install -g puppeteer` step.
#
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_PATH=/usr/local/lib/node_modules

RUN npm install -g puppeteer@23.6.0
