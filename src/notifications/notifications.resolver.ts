import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql'

import { CurrentUser } from '../auth/decorator'
import { PostAndCommentUnion } from '../deletes/models/deletes.model'
import { User } from '../user/models/user.model'
import { Notification } from './models/notifications.model'
import { NotificationsService } from './notifications.service'

@Resolver(of => Notification)
export class NotificationsResolver {
  constructor (private readonly notificationsService: NotificationsService) {}

  @Mutation(of => Boolean, { description: '通知接收者本人已读一个通知' })
  async setReadNotification (@CurrentUser() user: User, @Args('id') notificationId: string) {
    return await this.notificationsService.setReadNotification(user.id, notificationId)
  }

  @Mutation(of => Boolean, { description: '批量设置通知已读' })
  async setReadNotifications (@CurrentUser() user: User, @Args('ids', { type: () => [String] }) notificationIds: string[]) {
    return await this.notificationsService.setReadNotifications(user.id, notificationIds)
  }

  @ResolveField(of => PostAndCommentUnion, { description: '通知涉及的对象' })
  async about (@Parent() notification: Notification) {
    return await this.notificationsService.about(notification.id)
  }

  @ResolveField(of => User, { description: '被通知的对象' })
  async to (@Parent() notification: Notification) {
    return await this.notificationsService.to(notification.id)
  }

  @ResolveField(of => User, { description: '通知的创建者，匿名评论时为空', nullable: true })
  async creator (@Parent() notification: Notification) {
    return await this.notificationsService.creator(notification.id)
  }
}
