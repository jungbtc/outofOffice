# Security policy

## Supported version

Security fixes currently target the latest `0.1.x` source and preview release.

## Reporting

Do not open a public issue for a suspected archive, XML, HTML, path, recovery, or installer vulnerability. Use the repository host’s private security advisory feature. Include the affected version, a minimal non-sensitive fixture, impact, and reproduction steps. Do not include real user documents.

Maintainers should acknowledge a report within seven days, provide a triage update within fourteen days, and coordinate disclosure after a fix is available. These are targets, not a warranty.

## Security boundaries

The frontend has no unrestricted filesystem or process capability. User-selected paths cross typed commands into Rust. Internal packages are treated as untrusted ZIP archives and checked for path traversal, entry count, expansion size, JSON size, version, kind, and extension. Imported macros or scripts are never executed. Office import is not enabled in this milestone.

Security limitations and hardening work are tracked in [docs/security.md](docs/security.md).
