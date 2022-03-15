import { Ability, AbilityBuilder, AbilityClass, ExtractSubjectType } from '@casl/ability'
import { Injectable } from '@nestjs/common'

import { Admin } from '../admin/models/admin.model'
import { Role, UserWithRolesAndPrivileges, UserWithRolesAndPrivilegesAndCredential } from '../auth/model/auth.model'
import { Pin } from '../pins/models/pins.model'
import { PostWithCreatorId } from '../posts/models/post.model'
import { IPRIVILEGE } from '../privileges/models/privileges.model'
import { Subject } from '../subject/model/subject.model'
import { User } from '../user/models/user.model'
import { Action, AppAbility, MustWithCredential, Subjects, ViewAppState } from './models/casl.model'

@Injectable()
export class CaslAbilityFactory {
  createForAdminAndUser (user: UserWithRolesAndPrivilegesAndCredential) {
    const { can, build } = new AbilityBuilder<Ability<[Action, Subjects]>>(
      Ability as AbilityClass<AppAbility>
    )

    if (this.personIdAdmin(user)) {
      if (['root', 'system'].includes(user?.userId)) {
        can(Action.Manage, 'all')
      } else if (user?.credential) {
        can(Action.Manage, MustWithCredential)
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_VIEW_STATE)) {
        can(Action.Read, ViewAppState, 'all')
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_AUTHEN_OTHER)) {
        can(Action.Authen, Admin, 'all')
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_AUTHEN_USER)) {
        can(Action.Authen, User, 'all')
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_DELETE_SUBJECT)) {
        can(Action.Delete, Subject, 'all')
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_ADD_PIN_ON_POST)) {
        can(Action.Create, Pin, 'all')
      }
      if (this.personHasPrivilege(user, IPRIVILEGE.ADMIN_CAN_REMOVE_PIN_ON_POST)) {
        can(Action.Delete, Pin, 'all')
      }
    } else if (this.personIsUser(user)) {
      can(Action.Manage, MustWithCredential)
      can(Action.Delete, Subject, 'all')
      if (this.personHasPrivilege(user, IPRIVILEGE.USER_CAN_CREATE_SUBJECT)) {
        can(Action.Create, Subject, 'all')
      }
    }

    can(Action.Read, PostWithCreatorId, 'all')

    return build({
      detectSubjectType: item => item.constructor as ExtractSubjectType<Subjects>
    })
  }

  personHasPrivilege (user: UserWithRolesAndPrivileges, privilege: IPRIVILEGE) {
    let r = false
    user?.privileges?.map(p => {
      if (p.value === privilege) {
        r = true
      }
      return p
    })
    return r
  }

  personIsUser (user: UserWithRolesAndPrivileges) {
    return user?.roles?.includes(Role.User)
  }

  personIdAdmin (user: UserWithRolesAndPrivileges) {
    return user?.roles?.includes(Role.Admin)
  }
}
