import { ForbiddenException, Injectable } from '@nestjs/common'

import { DbService } from '../db/db.service'
import { User } from '../user/models/user.model'
import { AddDealineArgs, Deadline, DeadlinesConnection } from './models/deadlines.model'

@Injectable()
export class DeadlinesService {
  constructor (private readonly dbService: DbService) {}
  async findDeadlinesByUId (id: string, startTime: string, endTime: string, first: number): Promise<DeadlinesConnection> {
    const query = `
      query v($uid: string, $startTime: string, $endTime: string) {
        totalCount(func: uid($uid)) @filter(type(User)) {
          deadlines @filter(type(Deadline)) {
            count(uid)
          }
        }
        user(func: uid($uid)) @filter(type(User)) {
          deadlines (orderdesc: startDate, first: ${first}) @filter(between(startDate, $startTime, $endTime) AND type(Deadline)) {
            id: uid
            expand(_all_)
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{totalCount: Array<{deadlines: [{count: number}]}>, user: Array<{deadlines: Deadline[]}>}>({ query, vars: { $uid: id, $startTime: startTime, $endTime: endTime } })

    return {
      totalCount: res.totalCount[0]?.deadlines[0]?.count ?? 0,
      nodes: res.user[0]?.deadlines ?? []
    }
  }

  async creator (id: string) {
    const query = `
      query v($deadlineId: string) {
        deadline(func:uid($deadlineId)) @filter(type(Deadline)) {
          creator @filter(type(User)) {
            id: uid
            expand(_all_)
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{deadline: Array<{creator: User}>}>({ query, vars: { $deadlineId: id } })
    return res.deadline[0]?.creator
  }

  async deadline (id: string) {
    const query = `
      query v($deadlineId: string) {
        deadline(func: uid($deadlineId)) @filter(type(Deadline)) {
          id: uid
          expand(_all_)
        }
      }
    `
    const res = await this.dbService.commitQuery<{deadline: Deadline[]}>({ query, vars: { $deadlineId: id } })
    return res.deadline[0]
  }

  async addDeadline (id: string, args: AddDealineArgs): Promise<Deadline> {
    const query = `
      query v($userId: string) {
        v(func: uid($userId)) @filter(type(User)) { v as uid }
      }
    `
    const condition = '@if( eq(len(v), 1) )'
    const mutation = {
      uid: '_:deadline',
      'dgraph.type': 'Deadline',
      courseContentId: args.courseContentId,
      courseId: args.courseId,
      ownerUserId: args.ownerUserId,
      notificationIds: args.notificationIds,
      parentId: args.parentId,
      sourceId: args.sourceId,
      courseName: args.courseName,
      dataPending: args.dataPending,
      dateAdded: args.dateAdded,
      startDate: args.startDate,
      endDate: args.endDate,
      dueDate: args.dueDate,
      eventType: args.eventType,
      eventUrl: args.eventUrl,
      groupCount: args.groupCount,
      ownerName: args.ownerName,
      receiverCount: args.receiverCount,
      recipientType: args.recipientType,
      seen: args.seen,
      sourceData: args.sourceData,
      sourceDataType: args.sourceDataType,
      sourceType: args.sourceType,
      title: args.title,
      type: args.type,
      viewId: args.viewId,
      creator: {
        uid: id,
        deadlines: {
          uid: '_:deadline'
        }
      }
    }

    const res = await this.dbService.commitConditionalUperts<Map<string, string>, {
      v: Array<{uid: string}>
    }>({
      mutations: [{
        mutation,
        condition
      }],
      query,
      vars: {
        $userId: id
      }
    })
    if (res.json.v.length !== 1) {
      throw new ForbiddenException(`用户 ${id} 不存在`)
    }
    return {
      id: res.uids.get('deadline'),
      ...args
    }
  }
}