# Release process

1. Update centralized version/name values in root `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `packages/shared`. A future release script will automate this.
2. Confirm the full AGPL license text, NOTICE, generated dependency report, privacy statement, and supported-format matrix are current.
3. Run TypeScript, lint, formatting, unit, Playwright, Rust formatting, Clippy, Rust tests, audit, and license jobs on Windows.
4. Build with `pnpm tauri build` on a clean Windows x64 runner.
5. Install, launch, associate, upgrade, and uninstall in Windows 10 and 11 VMs at 125%, 150%, and 200% scaling. Confirm user files and app-data are preserved.
6. Test paths with spaces, Korean, Chinese, emoji, and long Unicode names.
7. Rename/verify the NSIS artifact as `outofOffice_<version>_x64-setup.exe`, calculate SHA-256, scan, and optionally sign through protected CI secrets.
8. Publish release notes that distinguish completed, partial, and unsupported features. Never call an importer compatible without automated fixture evidence.

Community builds do not require signing. Official signing certificates and passwords must never enter the repository or build logs.
