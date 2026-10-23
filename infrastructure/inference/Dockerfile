# CPU-only Kronk model server, pinned to the current tested-candidate release.
# Verify image availability and pin by digest prior to production use.
FROM docker.io/ardanlabs/kronk:1.33.0-cpu

# Pre-provision a small GGUF and Kronk-compatible CPU native libraries at build
# time. This trades build duration/image size for reproducible container restarts.
USER 10001:10001
RUN kronk libs --local && \
    kronk model pull unsloth/Qwen3-0.6B-Q8_0 --local
