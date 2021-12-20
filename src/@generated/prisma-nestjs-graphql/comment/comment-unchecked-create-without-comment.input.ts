import { Field } from '@nestjs/graphql';
import { InputType } from '@nestjs/graphql';

@InputType()
export class CommentUncheckedCreateWithoutCommentInput {

    @Field(() => String, {nullable:true})
    id?: string;

    @Field(() => String, {nullable:false})
    content!: string;

    @Field(() => String, {nullable:false})
    replyToId!: string;
}
