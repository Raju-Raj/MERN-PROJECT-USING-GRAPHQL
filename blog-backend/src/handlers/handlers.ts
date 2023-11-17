import {GraphQLObjectType,GraphQLList,GraphQLID,GraphQLSchema,GraphQLString,GraphQLNonNull} from 'graphql'
import { BlogType, CommentType, UserType } from '../schema/schema'
import User from '../models/User'
import Blog from '../models/Blog'
import Comment from '../models/Comment'
import { Document, startSession } from 'mongoose'
import { compareSync, hashSync } from 'bcryptjs'

const RootQuery = new GraphQLObjectType({
    name:"RootQuery",
    fields:{
        //get all user
        users: {
            type:GraphQLList(UserType),
            async resolve(){
                return await User.find()
            }
        },
       //get user by id
        user: {
            type:UserType,
            args:{id:{type:GraphQLNonNull(GraphQLID)}},
            async resolve(parent,{id}){
                return await User.findById(id).populate("blogs")
            }
        },
      //get all blogs
      blogs:{
        type:GraphQLList(BlogType),
        async resolve(){
            return await Blog.find()
        }
      },
    //   get blog by id
    blog:{
        type:BlogType,
        args:{id:{type:GraphQLNonNull(GraphQLID)}},
        async resolve(parent,{id}){
            return await Blog.findById(id).populate("user comments");
        }
    },
      //get all comments
      comments:{
        type:GraphQLList(CommentType),
        async resolve(){
            return await Comment.find()
        }
      }
    }
})

const mutations = new GraphQLObjectType({
    name:"mutations",
    fields:{
        //user signup
        signup:{
            type:UserType,
            args:{
                name:{type:GraphQLNonNull(GraphQLString)},
                email:{type:GraphQLNonNull(GraphQLString)},
                password:{type:GraphQLNonNull(GraphQLString)}
            },
            async resolve(parent,{name,email,password}){
                let existingUser:Document<any,any,any>;
                try{
                    existingUser = await User.findOne({email});
                    if(existingUser) return new Error("User Already Exists");
                      const encryptedPassword = hashSync(password);
                      const user = new User({name,email,password:encryptedPassword});
                      return await user.save()
                }catch(error){
                    return new Error("User Signup failed, Try Again")
                }
            }
        },
        //user login
        login:{
            type:UserType,
            args:{
                email:{type:GraphQLNonNull(GraphQLString)},
                password:{type:GraphQLNonNull(GraphQLString)},
            },
            async resolve(parent,{email,password}){
                let existingUser : Document<any,any,any>;
                try{
                    existingUser = await User.findOne({email});
                    if(!existingUser){
                        return new Error("No User Registered with this Email");
                    }
                    const decryptedPassword = compareSync(
                    password,
                    // @ts-ignore 
                    existingUser.password
                    );
                    if(!decryptedPassword){
                        return new Error("Incorrect Password");
                    }
                    return existingUser;
                }catch(error){
                    return new Error(error)
                }
            }
        },
        //create blog
        addBlog:{
            type:BlogType,
            args:{
                title:{type:GraphQLNonNull(GraphQLString)},
                content:{type:GraphQLNonNull(GraphQLString)},
                date:{type:GraphQLNonNull(GraphQLString)},
                user:{type:GraphQLNonNull(GraphQLID)},
            },
            async resolve(parent,{title,content,date,user}){
                let blog : Document<any,any,any>;
                const session = await startSession();
                session.startTransaction({session})
                try{
                    blog = new Blog({title,content,date,user})
                    const existingUser = await User.findById(user);
                    if(!existingUser) return new Error("User Not found Exiting")
                    //@ts-ignore
                    existingUser.blogs.push(blog);
                    await existingUser.save({session});
                    return await blog.save({session});
                }catch(error){
                    return new Error(error);
                }finally{
                    await session.commitTransaction();
                }
            }
        },
        //update blog
        updateBlog:{
            type:BlogType,
            args:{
                id:{type:GraphQLNonNull(GraphQLID)},
                title:{type:GraphQLNonNull(GraphQLString)},
                content:{type:GraphQLNonNull(GraphQLString)},
            },
            async resolve(parent,{id,title,content}){
                let existingBlog : Document<any,any,any>;
                try{
                    existingBlog = await Blog.findById(id);
                    if(!existingBlog) return new Error("Blog Does not Exist");
                    return await Blog.findByIdAndUpdate(id,{title,content},{new:true})
                }catch(error){
                    return new Error(error)
                }
            }
        },
        //delete blog
        deleteBlog:{
            type:BlogType,
            args:{
                id:{type:GraphQLNonNull(GraphQLID)}
            },
            async resolve(parent,{id}){
                let existingBlog:Document<any,any,any>
                const session = await startSession();
                try{
                    session.startTransaction({session})
                    existingBlog = await Blog.findById(id).populate("user");
                    //@ts-ignore
                    const existingUser = existingBlog?.user
                    if(!existingUser) return new Error("No user linked to this blog")
                    if(!existingBlog) return new Error("No Blog Found");
                    existingUser.blogs.pull(existingBlog);
                    await existingUser.save({session});
                    //@ts-ignore
                    // await existingBlog.remove({ session });
                     await existingBlog.deleteOne({id:existingBlog.id});
                    // await Blog.deleteOne({ _id: id }).session(session);
                    return existingBlog;
                }catch(error){
                    return new Error(error)
                }finally{
                    session.commitTransaction();
                }
            }
        },
        //add comment to blog
        addCommentToBlog:{
            type:CommentType,
            args:{
                blog:{type:GraphQLNonNull(GraphQLID)},
                user:{type:GraphQLNonNull(GraphQLID)},
                text:{type:GraphQLNonNull(GraphQLString)},
                date:{type:GraphQLNonNull(GraphQLString)},
            },
            async resolve(parent,{user,blog,text,date}){
                const session = await startSession();
                let comment:Document<any,any,any>;
                try{
                   session.startTransaction({session});
                   const existingUser = await User.findById(user);
                   const existingBlog = await Blog.findById(blog);
                   if(!existingBlog || !existingUser) return new Error("User or Blog Does Not Exist")
                   comment = new Comment({
                  text,
                  date,
                  blog,
                  user
                   });
                   //@ts-ignore
                   existingUser.comments.push(comment);
                   existingBlog.comments.push(comment);
                   await existingBlog.save({session});
                   await existingUser.save({session});
                   return await comment.save({session});
                }catch(err){
                    return new Error(err)
                }finally{
                    await session.commitTransaction();
                }
            }
        },
        //delete a comment from blog
        deleteComment:{
            type:CommentType,
            args:{
                id:{type:GraphQLNonNull(GraphQLID)}
            },
            async resolve(parent,{id}){
                let comment:Document<any,any,any>;
                const session = await startSession()
                try{
                    session.startTransaction({session});
                    comment = await Comment.findById(id);
                    if(!comment) return new Error("Comment not found");
                    //@ts-ignore
                    const existingUser = await User.findById(comment?.user);
                    if(!existingUser) return new Error("User Not Found");
                    //@ts-ignore
                    const existingBlog = await Blog.findById(comment?.blog);
                    if(!existingBlog) return new Error("Blog not found");
                    //@ts-ignore
                    existingUser.comments.pull(comment);
                    existingBlog.comments.pull(comment);
                    await existingUser.save({session});
                    await existingBlog.save({session});
                    // return comment.findByIdAndRemove({session})
                     await comment.deleteOne({id:comment.id});
                    // await Comment.deleteOne({ _id: id }).session(session);
                     return comment;
                }catch(err){
                    return new Error(err)
                }finally{
                    await session.commitTransaction();
                }
            }
        }
    }
})

export default new GraphQLSchema({query:RootQuery,mutation:mutations})