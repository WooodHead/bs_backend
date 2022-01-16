import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'

import { AuthService } from 'src/auth/auth.service'
import { CurrentJwtToken, CurrentUser } from 'src/auth/decorator'
import { PostsConnection } from 'src/posts/models/post.model'
import { Subject, SubjectId, SubjectsConnection } from 'src/subject/model/subject.model'
import { sign as sign_calculus } from 'src/tool'

import { CommentsConnection } from '../comment/models/comment.model'
import { DbService } from '../db/db.service'
import { UserId } from '../db/model/db.model'
import {
  CreateFollowRelationInput,
  DeleteFollowRelationInput,
  FolloweringsConnection,
  FollowersConnection,
  LoginResult,
  PagingConfigArgs,
  PersonLoginArgs,
  User,
  UserFollowASubjectInput,
  UserRegisterInput,
  UsersConnection,
  UserUpdateProfileInput
} from './models/user.model'
import { UserService } from './user.service'
@Resolver((_of: User) => User)
export class UserResolver {
  constructor (
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly dbService: DbService
  ) {}

  // 验证并签名用户 返回token
  @Query(returns => LoginResult, { name: 'login' })
  async login (
    @Args() args: PersonLoginArgs
  ): Promise<LoginResult> {
    const v = sign_calculus(args.sign)
    return await this.authService.login(args.userId, v)
  }

  @Query(returns => LoginResult)
  async authenticate (@Args('userId') userId: UserId, sign: String) {
    const r = await this.dbService.test()
    console.error(r)
    return {
      token: 'dsadsaokdsaoi'
    }
  }

  // 注册用户
  @Mutation(returns => User)
  async register (@Args('input') input: UserRegisterInput) {
    input.sign = sign_calculus(input.sign)
    return await this.userService.registerAUser(input)
  }

  @Query(returns => User)
  async whoAmI (@CurrentUser() user: User, @CurrentJwtToken() token: string) {
    return user
  }

  @Query(returns => UsersConnection)
  async users (@Args() args: PagingConfigArgs) {
    return await this.userService.users(args.first, args.offset)
  }

  @Mutation(returns => Boolean)
  async followUser (@CurrentUser() user: User, @Args('to') to: string) {
    const v: CreateFollowRelationInput = {
      to,
      from: user.userId
    }
    return await this.userService.followOne(v)
  }

  @Mutation(returns => Boolean)
  async unfollowUser (@CurrentUser() user: User, @Args('to') to: string) {
    const v: DeleteFollowRelationInput = {
      from: user.userId,
      to
    }
    return await this.userService.unfollowOne(v)
  }

  @Mutation(returns => Subject)
  async followSubject (@CurrentUser() user: User, @Args('id') id: SubjectId) {
    const l: UserFollowASubjectInput = {
      from: user.userId,
      to: id
    }
    return await this.userService.followASubject(l)
  }

  @ResolveField(returns => PostsConnection)
  async posts (@Parent() user: User, @Args() args: PagingConfigArgs) {
    return await this.userService.findPostsByUid(
      user.id,
      args.first,
      args.offset
    )
  }

  @ResolveField(returns => FollowersConnection)
  async followers (@Parent() user: User, @Args() args: PagingConfigArgs) {
    throw new Error('undefined')
    // return await this.userService.findFansByUserId(
    //   user.userId,
    //   input
    // )
  }

  @ResolveField(returns => FolloweringsConnection)
  async followings (@Parent() user: User, @Args() args: PagingConfigArgs) {
    throw new Error('undefined')
    // return await this.userService.findMyFollowedsByUserId(
    //   user.userId,
    //   input
    // )
  }

  @ResolveField(returns => SubjectsConnection)
  async subjects (@Parent() user: User, @Args() args: PagingConfigArgs) {
    return await this.userService.findSubjectsByUid(user.id, args.first, args.offset)
  }

  @ResolveField(returns => CommentsConnection)
  async comments (@Parent() user: User, @Args() args: PagingConfigArgs) {
    // 返回我的评论
    throw new Error('undefined')
    // return await this.userService.findMySubjects(user.userId, input)
  }

  @Mutation(returns => User, { description: '更新当前用户' })
  async updateUser (@CurrentUser() user: User, @Args() args: UserUpdateProfileInput
  ) {
    if (args.sign) {
      args.sign = sign_calculus(args.sign)
    }
    return await this.userService.updateUser(user.userId, args)
  }
}
