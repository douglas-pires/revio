# Releasing Revio

Merging into `main` does not ship anything to people using Revio. You decide when a set of changes goes out.

## What each push does

| You do                                           | The Release workflow publishes                                       | Offered as an update?                                      |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Merge a PR into `main`                           | A pre-release, e.g. `0.2.4-dev.43`                                   | No. GitHub never marks a pre-release as the latest release |
| Run the workflow by hand, or push a tag `v0.2.4` | A release, e.g. `0.2.4`, listing every change since the last release | Yes, to everyone, the next time Revio checks               |

The newest ten pre-releases are kept on the [Releases](https://github.com/douglas-pires/revio/releases) page. Older
ones are deleted. Install one to try what is on `main` before releasing it.

## Cutting a release

1. Make sure `main` holds what you want to ship, and nothing you don't: work that isn't ready waits in its PR, or is
   merged behind a setting that is off by default.
2. Try the newest pre-release from the Releases page.
3. Release it, either way:
   - Actions → **Release** → **Run workflow** on `main`. Pick what to raise from the last release (patch, minor or
     major), or type an exact version.
   - Or from a terminal: `gh workflow run release.yml -f bump=minor` (or `-f version=0.3.0` for an exact version).
   - Or tag the commit: `git tag v0.3.0 && git push origin v0.3.0`.

There is nothing to raise afterwards. Versions come from the highest release tag, and pre-releases are of the next
patch (`0.2.4-dev.43` after `0.2.3`). `package.json` keeps the placeholder `0.0.0`, which is what a build made on your
Mac calls itself, so it is offered the latest release as an update.

The workflow stops with an error if that version is already released, or isn't a plain `major.minor.patch`.

## How it reaches people

Installed copies of Revio install a release themselves: they read `latest-mac.yml` from it, download the zip, check it
against the checksum in there, and macOS checks that it is signed by the same team as the running copy. So a release
needs the zip and `latest-mac.yml` (the workflow uploads both), and must be signed: an ad-hoc build cannot be installed
over a signed one.

## Which number to pick

- **Patch** (`0.2.1`): fixes only.
- **Minor** (`0.3.0`): new features.
- **Major** (`1.0.0`): when Revio is stable enough to promise it won't break how you use it.
