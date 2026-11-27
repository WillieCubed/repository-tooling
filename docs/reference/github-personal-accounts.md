# GitHub personal accounts

Repository ownership, account plan, visibility and effective host protection are separate facts. The
status command reads repository metadata and uses authenticated account-plan information only when
the authenticated login is the configured owner. A repository-scoped workflow token may not have
access to that private account information; this remains unknown rather than defaulting to a paid
plan or treating an API permission failure as a missing ruleset.

Public repositories support rulesets on GitHub Free. A private repository owned by a personal Free
account reports unavailable host enforcement; a personal Pro account supports private rulesets.
Unknown plans and visibility report unverified availability. None of these findings authorizes
changing visibility or purchasing a plan. Local hooks do not replace server enforcement.

An observed ruleset name is insufficient proof of active enforcement, attachment to the selected
branch or required-check coverage. The report keeps those facts unverified until the effective
policy is inspected. The status command reads the selected branch's metadata and effective rules,
each effective rule's source ruleset and bypass actors, classic branch protection, repository merge
methods, Actions availability and default workflow-token permissions. The branch-rules endpoint also
answers for nonexistent branches, so matching rules alone do not prove the target exists. An omitted
bypass-actor field means the reader lacks evidence; it does not mean no bypasses exist. Permission
errors, including a classic-protection 404, remain unknown rather than observed absence. A report
with unavailable or unverified enforcement is not a conformance pass.

Use `pnpm standards:status --proposals` for a JSON report with per-branch proposals for public
personal repositories. It inspects the current repository without a central project catalog. Use
`--repo OWNER/REPOSITORY` to inspect another selected destination and `--branch NAME` to select its
branch. `--packages` explicitly adds legacy managed-package adoption checks; host inspection alone
does not require Node packages in the target project. These are optional operator commands, not
prerequisites for project creation, development or builds.

The command only reads GitHub state and writes its report. Proposals use explicit branch refs, no
bypass actors, rebase-only integration and zero mandatory human approvals. They are always disabled.
The current proposal command omits mandatory checks because their exact-candidate route and
integration publisher need separate acceptance. After that acceptance, a proposal still needs
separate review and application. A matching context name without the accepted publisher is
insufficient. The source `standards/ruleset.json` used by existing provisioning is separate;
generating proposals never patches or deactivates an existing ruleset.

Default workflow tokens should be read-only and unable to approve pull requests. Jobs request
additional permissions only for their own supported operations. Actions availability and token
defaults do not establish that an actual candidate job has run, that its workflow is trusted, or
that executing public contribution code on a persistent personal runner is safe.

Repository provisioning is separate from publication. Creating a missing repository requires an
explicit owner type (`User` or `Organization`) and visibility (`private` or `public`). Personal
creation uses the authenticated user's repository endpoint; an organization target uses its
organization endpoint. The authenticated user must be the intended personal owner.

Reconciliation of an existing repository changes only its merge methods: rebase enabled, merge
commits and squash disabled. It preserves visibility and archive state. A requested visibility
change or different default branch blocks reconciliation and needs separate review; these are not
incidental setup repairs. Provisioning must read the exact target back before declaring the
operation successful.

The provider contract is documented in
[GitHub's ruleset guidance](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository).
