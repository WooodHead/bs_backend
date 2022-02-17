import { ForbiddenException, Injectable } from '@nestjs/common'

import { Comment } from '../comment/models/comment.model'
import { ORDER_BY } from '../connections/models/connections.model'
import { DbService } from '../db/db.service'
import { PostAndCommentUnion } from '../deletes/models/deletes.model'
import { Post, RelayPagingConfigArgs } from '../posts/models/post.model'
import { btoa, ids2String, now, relayfyArrayForward } from '../tool'
import { NotificationArgs, User } from '../user/models/user.model'
import { Vote, VotesConnectionWithRelay } from '../votes/model/votes.model'
import { Notification, NOTIFICATION_ACTION, NOTIFICATION_TYPE, NotificationsConnection } from './models/notifications.model'

@Injectable()
export class NotificationsService {
  constructor (private readonly dbService: DbService) {}

  async setReadAllNotifications (xid: string) {
    const _now = now()
    const query = `
      query v($xid: string, $now: string) {
        var(func: uid($xid)) @filter(type(User)) {
          notifications @filter(lt(createdAt, $now) and eq(isRead, false)) {
            notifications as uid
          }
        }
        totalCount(func: uid(notifications)) {
          count(uid)
        }
      }
    `
    const condition = '@if( not eq(len(notifications), 0) )'
    const mutation = {
      uid: 'uid(notifications)',
      isRead: true
    }
    const res = await this.dbService.commitConditionalUperts<Map<string, string>, {
      totalCount: Array<{count: number}>
    }>({
      mutations: [{ mutation, condition }],
      query,
      vars: { $xid: xid, $now: _now }
    })

    if (res.json.totalCount[0]?.count === 0) {
      throw new ForbiddenException('当前用户所有通知都已读')
    }
    return true
  }

  async findUpvoteNotificationsByXidWithRelayForward (xid: string, first: number, after: string | null): Promise<VotesConnectionWithRelay> {
    const q1 = NOTIFICATION_ACTION.ADD_UPVOTE_ON_COMMENT
    const q2 = NOTIFICATION_ACTION.ADD_UPVOTE_ON_POST
    const q3 = 'var(func: uid(upvotes), orderdesc: createdAt) @filter(lt(createdAt, $after)) { q as uid }'
    const query = `
      query v($xid: string, $after: string) {
        var(func: uid($xid)) @filter(type(User)) {
          notifications as notifications @filter((eq(action, ${q1}) or eq(action, ${q2})) and eq(isRead, false))
        }
        var(func: uid(notifications), orderdesc: createdAt) @groupby(about) {
          abouts as count(uid)
        }
        var(func: uid(abouts)) @filter(type(Post) or type(Comment)) {
          votes (orderdesc: createdAt, first: 1) {
            lastUpvotes as uid
          }
        }
        # sorted by createdTime
        var(func: uid(lastUpvotes), orderdesc: createdAt) {
          upvotes as uid
        }

        ${after ? q3 : ''}
        upvoteNotifications(func: uid(${after ? 'q' : 'upvotes'}), orderdesc: createdAt, first: ${first}) {
          id: uid
          expand(_all_)
        }
        
        totalCount(func: uid(upvotes)) { count(uid) }
        # 开始游标
        startNotification(func: uid(upvotes), first: -1) {
          createdAt
        }
        # 结束游标
        endNotification(func: uid(upvotes), first: 1) {
          createdAt
        }
      }
    `
    const res = await this.dbService.commitQuery<{
      upvoteNotifications: Vote[]
      totalCount: Array<{count: number}>
      startNotification: Array<{createdAt: string}>
      endNotification: Array<{createdAt: string}>
    }>({ query, vars: { $xid: xid, $after: after } })

    return relayfyArrayForward<Vote>({
      startO: res.startNotification,
      endO: res.endNotification,
      objs: res.upvoteNotifications,
      first,
      after,
      totalCount: res.totalCount
    })
  }

  async findUpvoteNotificationsByXid (id: string, { first, after, before, last, orderBy }: RelayPagingConfigArgs) {
    after = btoa(after)
    before = btoa(before)

    if (first) {
      return await this.findUpvoteNotificationsByXidWithRelayForward(id, first, after)
    }
  }

  async setReadUpvoteNotifications (xid: string, aboutId: string[]) {

  }

  async setReadReplyNotifications (xid: string, notificationIds: string[]) {
    const query = `
      query v($xid: string) {
        var(func: uid(${ids2String(notificationIds)})) @filter(type(Notification) and uid_in(to, $xid)) {
          i as uid
        }

        patchCount(func: uid(i)) {
          count(uid)
        }
        notifications(func: uid(i)) {
          id: uid
          expand(_all_)
        }
      }
    `
    const condition = `@if( eq(len(i), ${notificationIds.length}))`
    const mutation = {
      uid: 'uid(i)',
      isRead: true
    }

    const res = await this.dbService.commitConditionalUperts<Map<string, string>, {
      patchCount: Array<{count: number}>
      notifications: Notification[]
    }>({ mutations: [{ mutation, condition }], query, vars: { $xid: xid } })

    if (res.json.patchCount[0]?.count !== notificationIds.length) {
      throw new ForbiddenException(`存在非 ${xid} 所有的通知`)
    }

    return true
  }

  async to (id: string) {
    const query = `
        query v($notificationId: string) {
            var(func: uid($notificationId)) @filter(type(Notification)) {
                to as to @filter(type(User))
            }
            to(func: uid(to)) {
                id: uid
                expand(_all_)
            }
        }
      `
    const res = await this.dbService.commitQuery<{to: User[]}>({ query, vars: { $notificationId: id } })
    return res.to[0]
  }

  async creator (id: string) {
    const query = `
    query v($notificationId: string) {
        var(func: uid($notificationId)) @filter(type(Notification)) {
            creator as creator @filter(type(User))
        }
        creator(func: uid(creator)) {
            id: uid
            expand(_all_)
        }
    }
  `
    const res = await this.dbService.commitQuery<{creator: User[]}>({ query, vars: { $notificationId: id } })
    return res.creator[0]
  }

  async about (id: string) {
    const query = `
        query v($notificationId: string) {
            var(func: uid($notificationId)) @filter(type(Notification)) {
                about as about @filter(type(Post) or type(Comment))
            }
            about(func: uid(about)) {
                id: uid
                expand(_all_)
                dgraph.type
            }
        }
      `
    const res = await this.dbService.commitQuery<{about: Array<(typeof PostAndCommentUnion) & {'dgraph.type': string[]}>}>({ query, vars: { $notificationId: id } })
    const about = res.about[0]

    if (about?.['dgraph.type']?.includes('Post')) {
      return new Post(about as unknown as Post)
    }
    if (about?.['dgraph.type']?.includes('Comment')) {
      return new Comment(about as unknown as Comment)
    }
  }

  async findReplyNotificationsByXid (id: string, config: NotificationArgs, { orderBy, first, last, after, before }: RelayPagingConfigArgs) {
    after = btoa(after)
    before = btoa(before)

    if (first && orderBy === ORDER_BY.CREATED_AT_DESC) {
      return await this.findReplyNotificationsByXidWithRelayForward(id, config, first, after)
    }
  }

  async findReplyNotificationsByXidWithRelayForward (xid: string, { type, actions }: NotificationArgs, first: number, after: string | null): Promise<NotificationsConnection> {
    const q1 = 'var(func: uid(notifications), orderdesc: createdAt) @filter(lt(createdAt, $after)) { q as uid }'
    const mayGetAll = type === NOTIFICATION_TYPE.ALL ? 'and has(isRead)' : ''
    const mayGetRead = type === NOTIFICATION_TYPE.READ ? 'and eq(isRead, true)' : ''
    const mayGetUnRead = type === NOTIFICATION_TYPE.UN_READ ? 'and eq(isRead, false)' : ''

    const mayActions = actions?.map(a => `eq(action, ${a})`)?.join(' or ')

    const query = `
        query v($xid: string, $after: string) {
            var(func: uid($xid)) @filter(type(User)) {
                notifications as notifications @filter( type(Notification) ${mayGetAll} ${mayGetRead} ${mayGetUnRead} and (${mayActions}) ) 
            }
            ${after ? q1 : ''}

            totalCount(func: uid(notifications)) { count(uid) }
            notifications(func: uid(${after ? 'q' : 'notifications'}), orderdesc: createdAt, first: ${first}) {
                id: uid
                expand(_all_)
            }
            # 开始游标
            startNotification(func: uid(notifications), first: -1) {
                id: uid
                createdAt
            }
            # 结束游标
            endNotification(func: uid(notifications), first: 1) {
                id: uid
                createdAt
            }
        }
    `
    const res = await this.dbService.commitQuery<{
      totalCount: Array<{count: number}>
      notifications: Notification[]
      startNotification: Array<{createdAt: string}>
      endNotification: Array<{createdAt: string}>
    }>({ query, vars: { $xid: xid, $after: after } })

    return relayfyArrayForward<Notification>({
      totalCount: res.totalCount,
      objs: res.notifications,
      startO: res.startNotification,
      endO: res.endNotification,
      first,
      after
    })
  }
}
