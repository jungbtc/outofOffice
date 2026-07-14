# Contributing to outofOffice

Thank you for helping build an independent, local-first office suite.

## Before opening a change

1. Search existing issues and describe the user workflow you intend to improve.
2. Keep editor business logic out of React components. Extend a model and serializable command first.
3. Do not add cloud services, telemetry, proprietary APIs, Microsoft assets, or commercially licensed core dependencies.
4. Record the SPDX license of every proposed dependency. Discuss large editor, rendering, archive, or file-format dependencies before installing them.

## Local checks

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `pnpm test:e2e`. Rust changes also require `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, and `cargo test --workspace`.

Add tests at the lowest useful layer. Parser and serializer changes require malicious-input tests as well as ordinary round trips. Never add a compatibility claim without a fixture proving it.

## Pull requests

Keep changes focused. Explain the workflow, security impact, tests run, format-version impact, and accessibility considerations. Contributions are accepted under AGPL-3.0-only; by submitting, you confirm you have the right to license the contribution on those terms.
