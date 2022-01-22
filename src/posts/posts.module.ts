import { Module } from '@nestjs/common'

import { DbService } from 'src/db/db.service'
import { SubjectService } from 'src/subject/subject.service'
import { UserService } from 'src/user/user.service'

import { CaslModule } from '../casl/casl.module'
import { ReportsService } from '../reports/reports.service'
import { PostsResolver } from './posts.resolver'
import { PostsService } from './posts.service'

@Module({
  providers: [
    PostsResolver,
    DbService,
    PostsService,
    UserService,
    SubjectService,
    ReportsService,
    CaslModule
  ]
})
export class PostsModule {}
