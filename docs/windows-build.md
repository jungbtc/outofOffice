# Windows build

## Requirements

- Windows 10 or 11 x64
- Node.js 20.19+ and pnpm 10+
- Rust stable, target `x86_64-pc-windows-msvc`
- Visual Studio 2022 Build Tools: MSVC v143 C++ build tools and Windows 10/11 SDK
- WebView2 Runtime

Install Rust from [rustup.rs](https://rustup.rs/) and choose the default MSVC toolchain. In Visual Studio Installer, select “Desktop development with C++”.

Verify:

```powershell
node --version
pnpm --version
rustc --version
cargo --version
```

## Develop

```powershell
pnpm install --frozen-lockfile
pnpm tauri dev
```

The Tauri configuration starts Vite automatically. Internal save/open, recents, recovery, drag-and-drop, and file launch should be tested in the native window, not a browser tab.

## Build

```powershell
pnpm typecheck
pnpm lint
pnpm test
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm tauri build
```

Expected outputs:

- `target\release\outofOffice.exe`
- `target\release\bundle\nsis\outofOffice_0.1.0_x64-setup.exe`

The NSIS configuration installs per user, creates a Start Menu group and uninstaller, registers `.oofdoc`, and embeds the WebView2 offline installer. Uninstalling does not delete documents or the user’s app-data recovery/settings directory.

## Code signing

Signing is optional for community builds. Release infrastructure may inject a certificate thumbprint, timestamp URL, and certificate-store configuration into Tauri’s Windows bundle configuration. Keep certificate material in CI secrets or the Windows certificate store; never commit PFX files, passwords, private keys, or base64 certificate data.

## Troubleshooting

- `link.exe not found`: install/repair the MSVC C++ workload and launch a new Developer PowerShell.
- WebView2 errors: install the Evergreen Runtime or rebuild the NSIS package with the configured offline runtime.
- A Vite config access error in a restricted sandbox: `--configLoader runner` is already used by project scripts.
- Unsigned installer warning: expected for community builds; verify the artifact hash before running it.
- Unicode-path tests should include spaces, Korean and Chinese characters, emoji, and long filenames under the normal user profile.
