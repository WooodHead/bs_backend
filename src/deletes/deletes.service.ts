import { ForbiddenException, Injectable } from '@nestjs/common'
import { DgraphClient } from 'dgraph-js'

import { Admin } from '../admin/models/admin.model'
import { Comment } from '../comment/models/comment.model'
import { DbService } from '../db/db.service'
import { Post } from '../posts/models/post.model'
import { Subject } from '../subject/model/subject.model'
import { Delete, DeletesConnection, PostAndCommentAndSubjectUnion } from './models/deletes.model'

@Injectable()
export class DeletesService {
  private readonly dgraph: DgraphClient
  constructor (private readonly dbService: DbService) {
    this.dgraph = dbService.getDgraphIns()
  }

  async findDeleteByCommentId (id: string) {
    const query = `
      query v($commentId: string) {
        comment(func: uid($commentId)) @filter(type(Comment)) {
          delete @filter(type(Delete)) {
            id: uid
            expand(_all_)
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{comment: Array<{delete: Delete}>}>({ query, vars: { $commentId: id } })
    return res.comment[0]?.delete
  }

  async findDeleteByPostId (id: string) {
    const query = `
      query v($postId: string) {
        post(func: uid($postId)) @filter(type(Post)) {
          delete @filter(type(Delete)) {
            id: uid
            expand(_all_)
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{post: Array<{delete: Delete}>}>({ query, vars: { $postId: id } })
    return res.post[0]?.delete
  }

  async to (deleteId: string): Promise<typeof PostAndCommentAndSubjectUnion> {
    const query = `
      query v($deleteId: string) {
        delete(func: uid($deleteId)) @filter(type(Delete)) {
          to @filter(type(Comment) or type(Post) or type(Subject)) {
            id: uid
            expand(_all_)
            dgraph.type
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{delete: Array<{to: (Comment | Post) & { 'dgraph.type': Array<'Post'|'Comment'|'Subject'>}}>}>({ query, vars: { $deleteId: deleteId } })
    if (res.delete[0]?.to['dgraph.type'].includes('Post')) {
      return new Post(res.delete[0]?.to as unknown as Post)
    }
    if (res.delete[0]?.to['dgraph.type'].includes('Comment')) {
      return new Comment(res.delete[0]?.to as unknown as Comment)
    }
    if (res.delete[0]?.to['dgraph.type'].includes('Subject')) {
      return new Subject(res.delete[0]?.to as unknown as Subject)
    }
  }

  async creator (deleteId: string) {
    const query = `
      query v($deleteId: string) {
        delete(func: uid($deleteId)) @filter(type(Delete)) {
          creator @filter(type(Admin)) {
            id: uid
            expand(_all_)
          }
        }
      }
    `
    const res = await this.dbService.commitQuery<{delete: Array<{creator: Admin}>}>({ query, vars: { $deleteId: deleteId } })
    return res.delete[0]?.creator
  }

  async delete (deleteId: string) {
    const query = `
      query v($deleteId: string) {
        delete(func: uid($deleteId)) @filter(type(Delete)) {
          id: uid
          expand(_all_)
        }
      }
    `
    const res = await this.dbService.commitQuery<{delete: Delete[]}>({ query, vars: { $deleteId: deleteId } })
    if (res.delete.length !== 1) {
      throw new ForbiddenException(`删除操作 ${deleteId} 不存在`)
    }
    return res.delete
  }

  async deletes (first: number, offset: number): Promise<DeletesConnection> {
    const query = `
      query {
        totalCount (func: type(Delete)) { count(uid) }
        deletes (func: type(Delete), orderdesc: createdAt, first: ${first}, offset: ${offset}) {
          id: uid
          expand(_all_)
        }
      }
    `
    const res = await this.dbService.commitQuery<{
      totalCount: Array<{count: number}>
      deletes: Delete[]
    }>({ query })

    return {
      totalCount: res.totalCount[0]?.count ?? 0,
      nodes: res.deletes ?? []
    }
  }

  async deleteComment (adminId: string, commentId: string): Promise<Delete> {
    const now = new Date().toISOString()
    const query = `
        query v($adminId: string, $commentId: string) {
          # 管理员存在
          v(func: uid($adminId)) @filter(type(Admin)) { v as uid }
          # 评论存在
          u(func: uid($commentId)) @filter(type(Comment)) { u as uid }
          # 评论未被删除
          x(func: uid($commentId)) @filter(type(Comment)) {
            delete @filter(type(Delete)) {
              x as uid
            }
          }
        }
      `
    const conditions = '@if( eq(len(v), 1) AND eq(len(u), 1) AND eq(len(x), 0) )'
    const mutation = {
      uid: '_:delete',
      'dgraph.type': 'Delete',
      createdAt: now,
      to: {
        uid: commentId,
        delete: {
          uid: '_:delete'
        }
      },
      creator: {
        uid: adminId,
        deletes: {
          uid: '_:delete'
        }
      }
    }
    const res = await this.dbService.commitConditionalUpsertWithVars<Map<string, string>, {
      v: Array<{uid: string}>
      u: Array<{uid: string}>
      x: Array<{}>
    }>({
      conditions,
      mutation,
      query,
      vars: {
        $adminId: adminId,
        $commentId: commentId
      }
    })

    if (res.json.x.length !== 0) {
      throw new ForbiddenException(`评论 ${commentId} 已被删除`)
    }
    if (res.json.v.length !== 1) {
      throw new ForbiddenException(`管理员 ${adminId} 不存在`)
    }
    if (res.json.u.length !== 1) {
      throw new ForbiddenException(`评论 ${commentId} 不存在`)
    }
    return {
      createdAt: now,
      id: res.uids.get('delete')
    }
  }

  async deletePost (adminId: string, postId: string): Promise<Delete> {
    const now = new Date().toISOString()

    const query = `
        query v($adminId: string, $postId: string) {
          # 管理员存在
          v(func: uid($adminId)) @filter(type(Admin)) { v as uid }
          # 帖子存在
          u(func: uid($postId)) @filter(type(Post)) { u as uid }
          # 帖子未被删除
          x(func: uid($postId)) @filter(type(Post)) {
            delete @filter(type(Delete)) {
              x as uid
            }
          }
        }
      `
    const conditions = '@if( eq(len(v), 1) AND eq(len(u), 1) AND eq(len(x), 0) )'
    const mutation = {
      uid: '_:delete',
      'dgraph.type': 'Delete',
      createdAt: now,
      to: {
        uid: postId,
        delete: {
          uid: '_:delete'
        }
      },
      creator: {
        uid: adminId,
        deletes: {
          uid: '_:delete'
        }
      }
    }
    const res = await this.dbService.commitConditionalUpsertWithVars<Map<string, string>, {
      v: Array<{uid: string}>
      u: Array<{uid: string}>
      x: Array<{}>
    }>({
      conditions,
      mutation,
      query,
      vars: {
        $adminId: adminId,
        $postId: postId
      }
    })

    if (res.json.x.length !== 0) {
      throw new ForbiddenException(`帖子 ${postId} 已被删除`)
    }
    if (res.json.v.length !== 1) {
      throw new ForbiddenException(`管理员 ${adminId} 不存在`)
    }
    if (res.json.u.length !== 1) {
      throw new ForbiddenException(`帖子 ${postId} 不存在`)
    }
    return {
      createdAt: now,
      id: res.uids.get('delete')
    }
  }
}
