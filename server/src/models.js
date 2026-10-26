import mongoose from 'mongoose';
const {Schema}=mongoose;
export const User=mongoose.model('User',new Schema({name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true}},{timestamps:true}));
export const Category=mongoose.model('Category',new Schema({userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},name:{type:String,required:true,trim:true},color:{type:String,default:'#5B8DB8'}},{timestamps:true}));
const task=new Schema({userId:{type:Schema.Types.ObjectId,ref:'User',required:true},title:{type:String,required:true,trim:true},description:{type:String,default:''},
status:{type:String,enum:['pending','in_progress','completed'],default:'pending'},priority:{type:String,enum:['low','medium','high','urgent'],default:'medium'},
dueDate:Date,categoryId:{type:Schema.Types.ObjectId,ref:'Category',default:null},tags:[String],completedAt:Date},{timestamps:true});
task.index({userId:1,status:1,dueDate:1});
export const Task=mongoose.model('Task',task);
