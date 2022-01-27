import { ForbiddenException, Injectable } from '@nestjs/common'

import { DbService } from '../db/db.service'
import { ICredential, ICredentialsConnection } from './models/credentials.model'

@Injectable()
export class CredentialsService {
  constructor (private readonly dbService: DbService) {}
  async credentials (first: number, offset: number): Promise<ICredentialsConnection> {
    const query = `
        query {
            totalCount(func: type(Credential)) { count(uid) }
            credentials(func: type(Credential), orderdesc: createdAt, first: ${first}, offset: ${offset}) {
                id: uid
                expand(_all_)
            }
        }
      `
    const res = await this.dbService.commitQuery<{
      credentials: ICredential[]
      totalCount: Array<{count: number}>
    }>({ query })
    return {
      totalCount: res.totalCount[0]?.count ?? 0,
      nodes: res.credentials ?? []
    }
  }

  async credential (credentialId: string) {
    const query = `
        query v($credentialId: string) {
            credential(func: uid($credentialId)) @filter(type(Credential)) {
                id: uid
                expand(_all_)
            }
        }
      `
    const res = await this.dbService.commitQuery<{credential: ICredential[]}>({ query, vars: { $credentialId: credentialId } })
    if (res.credential.length !== 1) {
      throw new ForbiddenException(`凭证 ${credentialId} 不存在`)
    }
    return res.credential[0]
  }
}
