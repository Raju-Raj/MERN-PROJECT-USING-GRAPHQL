import express from "express";
import {config} from 'dotenv';
import { connectToDatabase } from "./utils/connection";
import { graphqlHTTP } from "express-graphql";
import schema from "./handlers/handlers";
import cors from "cors";

//Dotenv config
config()

const app = express();

app.use(cors());

app.use("/graphql",graphqlHTTP({schema:schema,graphiql:true}))

connectToDatabase().then(()=>{
    app.listen(process.env.PORT,()=>console.log(`Server Open On Port ${process.env.PORT}`))
}).catch(err=>console.log(err))

// 1:19:50
//3:17:25
//4:55
//6:31
//7:00
//8:15
//10:06:20