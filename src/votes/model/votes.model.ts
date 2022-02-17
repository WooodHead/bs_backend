import { Field, Int, ObjectType } from '@nestjs/graphql'

import { Connection } from '../../connections/models/connections.model'

@ObjectType()
export class Votable {
  @Field(type => Int, { description: '对象当前总赞数' })
    totalCount: number

  @Field(type => Boolean, { description: '浏览者是否能点赞' })
    viewerCanUpvote: boolean

  @Field(type => Boolean, { description: '浏览者是否已经点赞' })
    viewerHasUpvoted: boolean

  @Field({ description: '被点赞或取消点赞的对象的id' })
    to: string
}

@ObjectType()
export class VotesConnection {
  @Field(type => Int)
    totalCount: number

  @Field(type => Boolean)
    viewerCanUpvote: boolean

  @Field(type => Boolean)
    viewerHasUpvoted: boolean

  @Field(type => [Vote])
    nodes: Vote[]
}

@ObjectType()
export class Vote {
  @Field()
    id: string

  @Field()
    createdAt: string
}

@ObjectType()
export class VotesConnectionWithRelay extends Connection<Vote>(Vote) {}
