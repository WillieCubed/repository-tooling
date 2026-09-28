# Documentation standard

How a personal repository's documentation is laid out, which documents it must have, and how they
are written. `pnpm check` enforces the layout, the required documents, and their required sections
through `cube check documents` and markdownlint.

## Layout

Documentation follows [Diátaxis](https://diataxis.fr) inside domain directories:

```text
docs/
  README.md
  <domain>/<tutorials|how-to|reference|explanation>/<topic>.md
  superpowers/specs/YYYY-MM-DD-<topic>-design.md
  superpowers/plans/YYYY-MM-DD-<topic>.md
```

| Domain        | Covers                                          |
| ------------- | ----------------------------------------------- |
| `development` | Working on the code                             |
| `operations`  | Running it: deploys, restores, incidents        |
| `product`     | What it is for and who uses it                  |
| `security`    | Secrets, personal data, admin, threat decisions |

`docs/README.md` lists every document. File names are kebab-case topics. Numbered file names are not
used, because a number records when a document was written, not what it covers.

Design records written while planning live in `docs/superpowers/`, dated. They are exempt from the
writing rules and markdownlint, and they are never updated after the work ships; the documents they
produced are.

## Required documents

| Document                                  | Required in                     | Required `##` sections, in order                                 |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `development/tutorials/start-here.md`     | Every repository                | Free                                                             |
| `development/reference/glossary.md`       | Every repository                | Free; each term has an anchor id                                 |
| `development/explanation/architecture.md` | Every deployed app              | The twelve [arc42](https://arc42.org/overview) sections, exactly |
| `operations/how-to/operations.md`         | Every deployed app              | Deploy, Roll back, Migrations, Restore, Incidents                |
| `security/reference/secrets.md`           | Every repository with a secret  | Inventory, Rotation, Prevention, Rules                           |
| `security/reference/data-inventory.md`    | Every app storing personal data | Inventory, Retention, Deletion, Backups, Exports                 |
| `security/reference/admin.md`             | Every app with admin            | Access, Routes, Audit actions, Webhooks                          |

### Section contents

- **Operations:** Deploy names the trigger and what runs. Roll back names the command and its
  limits. Migrations says when they apply relative to the deploy. Restore gives the restore command
  and the date it was last rehearsed. Incidents says where logs are and what to check first.
- **Secrets:** Inventory is a table of secret, where it lives, and what an attacker could do with
  it. Rotation has one `###` per secret. Prevention names what stops a secret reaching the
  repository. Rules lists handling constraints.
- **Data inventory:** Inventory is a table of table or bucket, the personal fields it holds, and why
  each is needed. Retention gives each one's period. Deletion names how each is deleted. Backups
  names the restore mechanism and window. Exports lists every export and who can run it.
- **Admin:** Access names the Access application, its destinations, and its policy. Routes lists the
  admin routes. Audit actions lists every action the app records. Webhooks lists every endpoint
  outside admin and how it verifies senders.

## Root files

| File          | Contents                                                     |
| ------------- | ------------------------------------------------------------ |
| `README.md`   | What the project is, the quick start, and links into `docs/` |
| `AGENTS.md`   | The standard header sections, then repository-specific rules |
| `CLAUDE.md`   | A symlink to `AGENTS.md`, never a separate file              |
| `LICENSE`     | Public repositories only                                     |
| `SECURITY.md` | Public repositories only: how to report a vulnerability      |

Issue forms and the pull request template come from `WillieCubed/.github`, so repositories do not
carry copies.

## Writing rules

- A heading is a noun phrase naming its contents.
- Sentences are complete, declarative, and specific. A section does not open by restating its
  heading, and reference documents do not address the reader.
- Numbers carry units and a source: `5 requests per 60 seconds per IP`, not `a low limit`.
- Use active voice and ordinary words, and cut hedges, filler, and stock metaphors.
- Name things by symbol so a reader can search for them. Architecture and explanation documents do
  not link to source files, because the links go stale when files move.
- A document states what is true now. History belongs in commits and design records.

## Enforcement

| Check                  | What fails it                                                   |
| ---------------------- | --------------------------------------------------------------- |
| markdownlint-cli2      | Style errors, lines over 100 characters, broken relative links  |
| `cube check documents` | A missing required document, or a missing or misordered section |
| `cube check filenames` | A document outside the layout, or a name that is not kebab-case |
