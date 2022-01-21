import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { GqlExecutionContext } from '@nestjs/graphql'
import { AuthGuard } from '@nestjs/passport'
import { memoize } from '@nestjs/passport/dist/utils/memoize.util'

import { NO_AUTH_KEY, ROLES_KEY } from './decorator'
import { Role, UserWithRoles } from './model/auth.model'

@Injectable()
export class RoleAuthGuard implements CanActivate {
  constructor (private readonly reflector: Reflector) {}
  canActivate (context: ExecutionContext) {
    const noAuth = this.reflector.get<boolean>(NO_AUTH_KEY, context.getHandler())
    if (noAuth) return true

    const roles = this.reflector.get<Role[]>(ROLES_KEY, context.getHandler())

    const guard = new (RoleGuard(roles || [Role.User]))()

    return guard.canActivate(context)
  }
}

export const RoleGuard = memoize((roles: Role[]) => {
  return class GqlAuthGuard extends AuthGuard('jwt') {
    getRequest (context: ExecutionContext) {
      const ctx = GqlExecutionContext.create(context)
      return ctx.getContext().req
    }

    handleRequest<TUser = any>(err: any, user: (UserWithRoles | null), info: any, context: any, status?: any): TUser {
      if (err) throw err
      if (!user) throw new UnauthorizedException('Not authorized')

      const notIncludes = roles.filter(r => !user.roles.includes(r))
      if (notIncludes.length !== 0) {
        throw new UnauthorizedException(`${user.id} not in [${notIncludes.toString()}] roles.`)
      }

      return user as unknown as any
    }
  }
})
