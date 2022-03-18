import { HttpException, HttpStatus } from '@nestjs/common'

export class UserNotFoundException extends HttpException {
  constructor (id: string) {
    super(`用户 ${id} 不存在`, HttpStatus.FORBIDDEN)
  }
}

export class AdminNotFoundException extends HttpException {
  constructor (id: string) {
    super(`管理员 ${id} 不存在`, HttpStatus.FORBIDDEN)
  }
}
