FROM eclipse-temurin:21-jdk-jammy AS java
FROM node:22.16.0-bookworm
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=/opt/java/openjdk/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip zip ffmpeg git \
    && rm -rf /var/lib/apt/lists/*
# Pinned official Android command-line tools; SDK and Java match Capacitor 8.
RUN curl --fail --location --retry 3 \
    https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip \
    -o /tmp/android-tools.zip \
    && mkdir -p /opt/android-sdk/cmdline-tools \
    && unzip -q /tmp/android-tools.zip -d /opt/android-sdk/cmdline-tools \
    && mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest \
    && rm /tmp/android-tools.zip \
    && yes | sdkmanager --licenses >/dev/null \
    && sdkmanager 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
RUN npm install --global pnpm@11.22.0
