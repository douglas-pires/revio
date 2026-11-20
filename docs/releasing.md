# Releasing Revio

Merging into `main` does not ship anything to people using Revio. You decide when a set of changes goes out.

## What each push does

| You do                                           | The Release workflow publishes                                       | Offered as an update?                                      |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Merge a PR into `main`                           | A pre-release, e.g. `0.2.0-dev.43`                                   | No. GitHub never marks a pre-release as the latest release |
| Run the workflow by hand, or push a tag `v0.2.0` | A release, e.g. `0.2.0`, listing every change since the last release | Yes, to everyone, the next time Revio checks               |

The newest ten pre-releases are kept on the [Releases](https://github.com/douglas-pires/revio/releases) page. Older
ones are deleted. Install one to try what is on `main` before releasing it.

## Cutting a release

1. Make sure `main` holds what you want to ship, and nothing you don't: work that isn't ready waits in its PR, or is
   merged behind a setting that is off by default.
2. Try the newest pre-release from the Releases page.
3. Release it, either way:
   - Actions → **Release** → **Run workflow** on `main`. Leave the version empty to use `package.json`'s, or type one.
   - Or from a terminal: `gh workflow run release.yml` (add `-f version=0.2.1` to choose the version).
   - Or tag the commit: `git tag v0.2.0 && git push origin v0.2.0`.
4. Raise `version` in `package.json` to the next release (e.g. `0.3.0`) in your next PR, so pre-releases from then
   on are builds of the next version.

The workflow stops with an error if that version is already released, or isn't a plain `major.minor.patch`.

## Which number to pick

- **Patch** (`0.2.1`): fixes only.
- **Minor** (`0.3.0`): new features.
- **Major** (`1.0.0`): when Revio is stable enough to promise it won't break how you use it.
