"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const schema_1 = require("../schema/schema");
const User_1 = __importDefault(require("../models/User"));
const Blog_1 = __importDefault(require("../models/Blog"));
const Comment_1 = __importDefault(require("../models/Comment"));
const mongoose_1 = require("mongoose");
const bcryptjs_1 = require("bcryptjs");
const RootQuery = new graphql_1.GraphQLObjectType({
    name: "RootQuery",
    fields: {
        //get all user
        users: {
            type: (0, graphql_1.GraphQLList)(schema_1.UserType),
            async resolve() {
                return await User_1.default.find();
            }
        },
        //get user by id
        user: {
            type: schema_1.UserType,
            args: { id: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) } },
            async resolve(parent, { id }) {
                return await User_1.default.findById(id).populate("blogs");
            }
        },
        //get all blogs
        blogs: {
            type: (0, graphql_1.GraphQLList)(schema_1.BlogType),
            async resolve() {
                return await Blog_1.default.find();
            }
        },
        //   get blog by id
        blog: {
            type: schema_1.BlogType,
            args: { id: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) } },
            async resolve(parent, { id }) {
                return await Blog_1.default.findById(id).populate("user comments");
            }
        },
        //get all comments
        comments: {
            type: (0, graphql_1.GraphQLList)(schema_1.CommentType),
            async resolve() {
                return await Comment_1.default.find();
            }
        }
    }
});
const mutations = new graphql_1.GraphQLObjectType({
    name: "mutations",
    fields: {
        //user signup
        signup: {
            type: schema_1.UserType,
            args: {
                name: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                email: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                password: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) }
            },
            async resolve(parent, { name, email, password }) {
                let existingUser;
                try {
                    existingUser = await User_1.default.findOne({ email });
                    if (existingUser)
                        return new Error("User Already Exists");
                    const encryptedPassword = (0, bcryptjs_1.hashSync)(password);
                    const user = new User_1.default({ name, email, password: encryptedPassword });
                    return await user.save();
                }
                catch (error) {
                    return new Error("User Signup failed, Try Again");
                }
            }
        },
        //user login
        login: {
            type: schema_1.UserType,
            args: {
                email: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                password: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
            },
            async resolve(parent, { email, password }) {
                let existingUser;
                try {
                    existingUser = await User_1.default.findOne({ email });
                    if (!existingUser) {
                        return new Error("No User Registered with this Email");
                    }
                    const decryptedPassword = (0, bcryptjs_1.compareSync)(password, 
                    // @ts-ignore 
                    existingUser.password);
                    if (!decryptedPassword) {
                        return new Error("Incorrect Password");
                    }
                    return existingUser;
                }
                catch (error) {
                    return new Error(error);
                }
            }
        },
        //create blog
        addBlog: {
            type: schema_1.BlogType,
            args: {
                title: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                content: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                date: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                user: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) },
            },
            async resolve(parent, { title, content, date, user }) {
                let blog;
                const session = await (0, mongoose_1.startSession)();
                session.startTransaction({ session });
                try {
                    blog = new Blog_1.default({ title, content, date, user });
                    const existingUser = await User_1.default.findById(user);
                    if (!existingUser)
                        return new Error("User Not found Exiting");
                    //@ts-ignore
                    existingUser.blogs.push(blog);
                    await existingUser.save({ session });
                    return await blog.save({ session });
                }
                catch (error) {
                    return new Error(error);
                }
                finally {
                    await session.commitTransaction();
                }
            }
        },
        //update blog
        updateBlog: {
            type: schema_1.BlogType,
            args: {
                id: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) },
                title: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                content: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
            },
            async resolve(parent, { id, title, content }) {
                let existingBlog;
                try {
                    existingBlog = await Blog_1.default.findById(id);
                    if (!existingBlog)
                        return new Error("Blog Does not Exist");
                    return await Blog_1.default.findByIdAndUpdate(id, { title, content }, { new: true });
                }
                catch (error) {
                    return new Error(error);
                }
            }
        },
        //delete blog
        deleteBlog: {
            type: schema_1.BlogType,
            args: {
                id: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) }
            },
            async resolve(parent, { id }) {
                let existingBlog;
                const session = await (0, mongoose_1.startSession)();
                try {
                    session.startTransaction({ session });
                    existingBlog = await Blog_1.default.findById(id).populate("user");
                    //@ts-ignore
                    const existingUser = existingBlog?.user;
                    if (!existingUser)
                        return new Error("No user linked to this blog");
                    if (!existingBlog)
                        return new Error("No Blog Found");
                    existingUser.blogs.pull(existingBlog);
                    await existingUser.save({ session });
                    //@ts-ignore
                    // await existingBlog.remove({ session });
                    await existingBlog.deleteOne({ id: existingBlog.id });
                    // await Blog.deleteOne({ _id: id }).session(session);
                    return existingBlog;
                }
                catch (error) {
                    return new Error(error);
                }
                finally {
                    session.commitTransaction();
                }
            }
        },
        //add comment to blog
        addCommentToBlog: {
            type: schema_1.CommentType,
            args: {
                blog: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) },
                user: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) },
                text: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
                date: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLString) },
            },
            async resolve(parent, { user, blog, text, date }) {
                const session = await (0, mongoose_1.startSession)();
                let comment;
                try {
                    session.startTransaction({ session });
                    const existingUser = await User_1.default.findById(user);
                    const existingBlog = await Blog_1.default.findById(blog);
                    if (!existingBlog || !existingUser)
                        return new Error("User or Blog Does Not Exist");
                    comment = new Comment_1.default({
                        text,
                        date,
                        blog,
                        user
                    });
                    //@ts-ignore
                    existingUser.comments.push(comment);
                    existingBlog.comments.push(comment);
                    await existingBlog.save({ session });
                    await existingUser.save({ session });
                    return await comment.save({ session });
                }
                catch (err) {
                    return new Error(err);
                }
                finally {
                    await session.commitTransaction();
                }
            }
        },
        //delete a comment from blog
        deleteComment: {
            type: schema_1.CommentType,
            args: {
                id: { type: (0, graphql_1.GraphQLNonNull)(graphql_1.GraphQLID) }
            },
            async resolve(parent, { id }) {
                let comment;
                const session = await (0, mongoose_1.startSession)();
                try {
                    session.startTransaction({ session });
                    comment = await Comment_1.default.findById(id);
                    if (!comment)
                        return new Error("Comment not found");
                    //@ts-ignore
                    const existingUser = await User_1.default.findById(comment?.user);
                    if (!existingUser)
                        return new Error("User Not Found");
                    //@ts-ignore
                    const existingBlog = await Blog_1.default.findById(comment?.blog);
                    if (!existingBlog)
                        return new Error("Blog not found");
                    //@ts-ignore
                    existingUser.comments.pull(comment);
                    existingBlog.comments.pull(comment);
                    await existingUser.save({ session });
                    await existingBlog.save({ session });
                    // return comment.findByIdAndRemove({session})
                    await comment.deleteOne({ id: comment.id });
                    // await Comment.deleteOne({ _id: id }).session(session);
                    return comment;
                }
                catch (err) {
                    return new Error(err);
                }
                finally {
                    await session.commitTransaction();
                }
            }
        }
    }
});
exports.default = new graphql_1.GraphQLSchema({ query: RootQuery, mutation: mutations });
//# sourceMappingURL=handlers.js.map