import express from 'express';import cookieParser from 'cookie-parser';import cors from 'cors';import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';import rateLimit from 'express-rate-limit';import {z,ZodError} from 'zod';import mongoose from 'mongoose';
import {User,Task,Category} from './models.js';
export const app=express();
const prod=process.env.NODE_ENV==='production';
app.use(express.json({limit:'50kb'}));app.use(cookieParser());
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173',credentials:true}));
const wrap=f=>(q,s,n)=>Promise.resolve(f(q,s,n)).catch(n);
const fail=(status,error)=>Object.assign(new Error(error),{status});
const setCookie=(res,id)=>res.cookie('token',jwt.sign({id},process.env.JWT_SECRET,{expiresIn:'7d'}),{httpOnly:true,sameSite:'lax',secure:prod,maxAge:6048e5});
const pub=u=>({id:u._id,name:u.name,email:u.email});
const auth=wrap(async(req,res,next)=>{
  try{const {id}=jwt.verify(req.cookies.token,process.env.JWT_SECRET);req.user=await User.findById(id)}catch{}
  if(!req.user)throw fail(401,'Not authenticated');next();});
const validId=(req,res,next)=>mongoose.isValidObjectId(req.params.id)?next():next(fail(400,'Invalid id'));
const limiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true});

// ---- Auth
const creds=z.object({email:z.string().email().max(120),password:z.string().min(8,'Password must be at least 8 characters').max(100)});
app.post('/api/auth/register',limiter,wrap(async(req,res)=>{
  const b=creds.extend({name:z.string().trim().min(1,'Name is required').max(80)}).parse(req.body);
  if(await User.exists({email:b.email.toLowerCase()}))throw fail(409,'An account with this email already exists');
  const u=await User.create({name:b.name,email:b.email,passwordHash:await bcrypt.hash(b.password,12)});
  await Category.insertMany(['Work','Personal','Study','Projects','Other'].map(name=>({userId:u._id,name})));
  setCookie(res,u._id);res.status(201).json({user:pub(u)});}));
app.post('/api/auth/login',limiter,wrap(async(req,res)=>{
  const b=creds.parse(req.body);const u=await User.findOne({email:b.email.toLowerCase()});
  if(!u||!(await bcrypt.compare(b.password,u.passwordHash)))throw fail(401,'Incorrect email or password');
  setCookie(res,u._id);res.json({user:pub(u)});}));
app.post('/api/auth/logout',(req,res)=>res.clearCookie('token').json({ok:true}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:pub(req.user)}));

// ---- Categories
app.get('/api/categories',auth,wrap(async(req,res)=>{
  const cats=await Category.find({userId:req.user._id}).sort('createdAt').lean();
  const counts=await Task.aggregate([{$match:{userId:req.user._id}},{$group:{_id:'$categoryId',n:{$sum:1}}}]);
  res.json({categories:cats.map(c=>({...c,taskCount:counts.find(x=>String(x._id)===String(c._id))?.n||0}))});}));
app.post('/api/categories',auth,wrap(async(req,res)=>{
  const b=z.object({name:z.string().trim().min(1).max(40),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()}).parse(req.body);
  res.status(201).json({category:await Category.create({...b,userId:req.user._id})});}));
app.delete('/api/categories/:id',auth,validId,wrap(async(req,res)=>{
  const c=await Category.findOneAndDelete({_id:req.params.id,userId:req.user._id});if(!c)throw fail(404,'Category not found');
  await Task.updateMany({userId:req.user._id,categoryId:c._id},{categoryId:null});res.json({ok:true});}));

// ---- Tasks
const base=z.object({title:z.string().trim().min(1,'Title is required').max(200),description:z.string().max(2000),
  status:z.enum(['pending','in_progress','completed']),priority:z.enum(['low','medium','high','urgent']),
  dueDate:z.coerce.date().nullable(),categoryId:z.string().nullable(),tags:z.array(z.string().trim().min(1).max(30)).max(10)});
const createSchema=base.partial().required({title:true});const patchSchema=base.partial();
async function checkCat(userId,id){if(id&&!(mongoose.isValidObjectId(id)&&await Category.exists({_id:id,userId})))throw fail(400,'Invalid category');}
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
app.get('/api/tasks',auth,wrap(async(req,res)=>{
  const {q,status,priority,category,overdue,sort='due'}=req.query;const f={userId:req.user._id};
  if(['pending','in_progress','completed'].includes(status))f.status=status;
  if(['low','medium','high','urgent'].includes(priority))f.priority=priority;
  if(mongoose.isValidObjectId(category))f.categoryId=category;
  if(typeof q==='string'&&q.trim()){const rx=new RegExp(esc(q.trim()),'i');f.$or=[{title:rx},{description:rx},{tags:rx}];}
  if(overdue==='1'){f.dueDate={$lt:new Date()};f.status={$ne:'completed'};}
  const order={due:{dueDate:1,createdAt:-1},created:{createdAt:-1},updated:{updatedAt:-1},title:{title:1}}[sort]||{createdAt:-1};
  res.json({tasks:await Task.find(f).sort(order).limit(200).lean()});}));
app.get('/api/tasks/:id',auth,validId,wrap(async(req,res)=>{
  const t=await Task.findOne({_id:req.params.id,userId:req.user._id}).lean();if(!t)throw fail(404,'Task not found');res.json({task:t});}));
app.post('/api/tasks',auth,wrap(async(req,res)=>{
  const b=createSchema.parse(req.body);await checkCat(req.user._id,b.categoryId);
  if(b.status==='completed')b.completedAt=new Date();
  res.status(201).json({task:await Task.create({...b,userId:req.user._id})});}));
app.patch('/api/tasks/:id',auth,validId,wrap(async(req,res)=>{
  const b=patchSchema.parse(req.body);await checkCat(req.user._id,b.categoryId);
  if(b.status)b.completedAt=b.status==='completed'?new Date():null;
  const t=await Task.findOneAndUpdate({_id:req.params.id,userId:req.user._id},b,{new:true}).lean();
  if(!t)throw fail(404,'Task not found');res.json({task:t});}));
app.delete('/api/tasks/:id',auth,validId,wrap(async(req,res)=>{
  const t=await Task.findOneAndDelete({_id:req.params.id,userId:req.user._id});if(!t)throw fail(404,'Task not found');res.json({ok:true});}));

// ---- Dashboard (days bucketed in UTC)
app.get('/api/dashboard/summary',auth,wrap(async(req,res)=>{
  const userId=req.user._id;const now=new Date();
  const [by,overdue]=await Promise.all([Task.aggregate([{$match:{userId}},{$group:{_id:'$status',n:{$sum:1}}}]),
    Task.countDocuments({userId,status:{$ne:'completed'},dueDate:{$lt:now}})]);
  const n=s=>by.find(x=>x._id===s)?.n||0;const total=by.reduce((a,x)=>a+x.n,0);
  const since=new Date(now);since.setUTCDate(since.getUTCDate()-6);since.setUTCHours(0,0,0,0);
  const done=await Task.find({userId,completedAt:{$gte:since}},'completedAt').lean();
  const week=Array.from({length:7},(_,i)=>{const d=new Date(since);d.setUTCDate(d.getUTCDate()+i);const k=d.toISOString().slice(0,10);
    return {date:k,count:done.filter(t=>t.completedAt.toISOString().slice(0,10)===k).length};});
  res.json({total,completed:n('completed'),inProgress:n('in_progress'),pending:n('pending'),overdue,rate:total?Math.round(n('completed')/total*100):0,week});}));

app.use('/api',(req,res,next)=>next(fail(404,'Not found')));
app.use((err,req,res,next)=>{
  if(err instanceof ZodError)return res.status(400).json({error:err.issues[0].message,issues:err.issues.map(i=>({path:i.path.join('.'),message:i.message}))});
  const status=err.status||500;if(status===500)console.error(err);
  res.status(status).json({error:status===500&&prod?'Server error':err.message});});
