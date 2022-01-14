import { Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { join } from 'path'

import { AdminModule } from './admin/admin.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { CommentModule } from './comment/comment.module'
import { CommentService } from './comment/comment.service'
import { DbService } from './db/db.service'
import { NodeModule } from './node/node.module'
import { PostsModule } from './posts/posts.module'
import { PostsService } from './posts/posts.service'
import { SearchModule } from './search/search.module'
import { SharedModule } from './shared/shared.module'
import { SubjectModule } from './subject/subject.module'
import { UserModule } from './user/user.module'
import { UserService } from './user/user.service'
import { VotesModule } from './votes/votes.module'

@Module({
  imports: [
    GraphQLModule.forRoot({
      debug: true,
      playground: true,
      sortSchema: false,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql')
    }),
    PostsModule,
    UserModule,
    CommentModule,
    VotesModule,
    AdminModule,
    AuthModule,
    SharedModule,
    SubjectModule,
    SearchModule,
    NodeModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PostsService,
    DbService,
    CommentService,
    UserService
  ]
})
export class AppModule {}
