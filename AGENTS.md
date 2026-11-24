# Instructions for agents

## Conventional Commits

Pull request titles and commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This is required: do not open a pull request or commit with any other form, and retitle a pull request you find without it before working on it further.

```
<type>(<optional scope>): <description>
```

- **Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.
- **Type:** what the change means to someone using Revio. New behaviour is `feat`, a correction is `fix`; use the others when nothing changes for them.
- **Scope:** optional, lowercase, the area changed, such as `inbox` or `gitlog`.
- **Description:** imperative, starting with a lowercase letter, no full stop at the end.
- **Breaking change:** `!` before the colon, and a `BREAKING CHANGE:` footer saying what to do.

| Write                                         | Not                             |
| --------------------------------------------- | ------------------------------- |
| `feat: copy the branch name with ⌘⇧B`         | `Copy the branch name with ⌘⇧B` |
| `fix(inbox): keep the search when going back` | `Fixed search.`                 |

A pull request's title says what the whole pull request does, so it need not repeat any one commit.
