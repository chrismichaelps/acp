#!/usr/bin/env node
// @Acp.Scripts.GenerateOpenApi — regenerate the committed openapi.json from the REST contract.
// Imports the compiled contract, so run `pnpm build` first (the npm `openapi:generate`
// script does that for you). The openapi.test.ts drift gate is the CI authority.
import { writeFileSync } from 'node:fs'
import {
  buildAcpOpenApi,
  serializeOpenApi,
} from '../dist/infrastructure/http/openapi.js'

writeFileSync('openapi.json', serializeOpenApi(buildAcpOpenApi()))
console.log('openapi.json regenerated from the ACP REST contract')
