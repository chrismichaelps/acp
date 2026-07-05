/** @Acp.App.Cli.Usage — CLI usage text */
export const usage = `acp — Agent Coordination Protocol CLI

  acp workspace list
  acp session init --worker <id> --name <n> [--kind <k>] [--vendor <v>] [--capabilities <csv>] [--permissions <csv>]
  acp worker list
  acp worker get <worker_id>
  acp workspace create --name <n> --kind <k> --uri <u> [--default-branch <b>]
  acp workspace update <workspace_id> --name <n> --kind <k> --uri <u> [--default-branch <b>]
  acp workspace archive <workspace_id>
  acp work create <title> --workspace <id> [--priority <p>] [--description <d>]
  acp work list --workspace <id>
  acp work get <work_id>
  acp work claim <work_id> --worker <id>
  acp work update <work_id> --state <state>
  acp lease request --workspace <id> --holder <id> --kind <k> --uri <u> [--ttl <n>]
  acp lease list --workspace <id>
  acp lease release <lease_id>
  acp lease renew <lease_id> [--ttl <n>]
  acp lease revoke <lease_id>
  acp checkpoint create --workspace <id> --work <id> --summary <s>
  acp checkpoint list --work <id>|--workspace <id>
  acp checkpoint latest --work <id>
  acp artifact create --workspace <id> --work <id> --kind <k> [--uri <u>] [--summary <s>] [--content <c>]
  acp artifact pr --workspace <id> --work <id> --url <u> [--summary <s>]
  acp artifact update <artifact_id> --kind <k> [--uri <u>] [--media-type <m>] [--summary <s>] [--content <c>]
  acp artifact list --work <id>|--workspace <id>
  acp artifact content <artifact_id>
  acp artifact delete <artifact_id>
  acp review request --work <id> --by <id> [--reviewer <id>]
  acp review list --work <id>|--workspace <id>
  acp review approve <review_id> --met <requirement,csv> [--signature <s> --signature-algorithm <alg> --signature-key <key-id> [--signed-at <iso>]]
  acp review reject <review_id>
  acp review request-changes <review_id>
  acp review cancel <review_id>
  acp memory create --workspace <id> --kind <k> --key <k> --summary <s> --content <c> [--work <id>] [--labels <csv>]
  acp memory list --workspace <id> [--after <seq>] [--limit <n>] [--work <id>] [--kind <k>] [--key <k>] [--label <l>]
  acp events list --workspace <id> [--after <seq>]
  acp events stream --workspace <id>

Targets ACP_BASE_URL (default http://localhost:$ACP_PORT).`
