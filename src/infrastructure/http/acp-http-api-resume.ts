/** @Acp.Infra.Http.ResumeApi — compact resume endpoint contract */
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from '@effect/platform'
import { Schema } from 'effect'
import {
  ProtocolError,
  WorkId,
  WorkResumePacket,
} from '../../protocol/schema/index.js'

const ResumeWorkPath = Schema.Struct({
  work_id: HttpApiSchema.param('work_id', WorkId),
})

const protocolError = (status: number) =>
  ({ status }) satisfies { readonly status: number }

export const ResumeGroup = HttpApiGroup.make('resume').add(
  HttpApiEndpoint.get('getWorkResumePacket', '/v1/work/:work_id/resume')
    .setPath(ResumeWorkPath)
    .addSuccess(WorkResumePacket)
    .addError(ProtocolError, protocolError(401))
    .addError(ProtocolError, protocolError(404)),
)
