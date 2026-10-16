# Release 0.0.3

The shared setup action now pins pnpm/action-setup 6.1.0 and actions/setup-node 7.1.0 by commit SHA.
Both retain the Node 24 action runtime. Node, pnpm, registry, cache, and authentication inputs are
unchanged. The example repositories carry the same pins.

Consumers must copy the updated `.github/actions/setup-node-pnpm/action.yml` after this release is
published: the standard update token cannot write workflow files. This local release preparation
does not publish packages or create a tag.
