import {useEffect,useState,useCallback} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';

async function api(path,{method='GET',body}={}){
  const r=await fetch('/api'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body&&JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d;}
const STATUS={pending:'Pending',in_progress:'In Progress',completed:'Completed'};
const fmt=d=>d?new Date(d).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'No due date';
const late=t=>t.dueDate&&t.status!=='completed'&&new Date(t.dueDate)<new Date();
const Logo=()=><div className="logo"><svg width="22" height="22" viewBox="0 0 32 32"><path d="M6 8l10 17L26 8" stroke="#fff" fill="none" strokeWidth="3"/></svg>VELORA</div>;

function Auth({onAuth}){
  const [reg,setReg]=useState(false),[f,setF]=useState({name:'',email:'',password:'',confirm:''}),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  async function submit(e){e.preventDefault();setErr('');
    if(reg&&f.password!==f.confirm)return setErr('Passwords do not match');
    setBusy(true);try{const d=await api(reg?'/auth/register':'/auth/login',{method:'POST',body:{name:f.name,email:f.email,password:f.password}});onAuth(d.user)}catch(x){setErr(x.message)}finally{setBusy(false)}}
  const strength=['Too short','Weak','Fair','Good','Strong'][f.password.length<8?0:1+[/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(f.password)).length];
  return <div className="auth"><form onSubmit={submit}><Logo/><h1>{reg?'Create your workspace':'Welcome back'}</h1>
    <p className="mute">Bring clarity to every task. Make progress visible.</p>
    {reg&&<label>Full name<input required value={f.name} onChange={set('name')}/></label>}
    <label>Email<input type="email" required value={f.email} onChange={set('email')}/></label>
    <label>Password<input type={show?'text':'password'} required minLength={8} value={f.password} onChange={set('password')}/></label>
    {reg&&<><label>Confirm password<input type={show?'text':'password'} required value={f.confirm} onChange={set('confirm')}/></label><span className="mute">Strength: {strength}</span></>}
    <label style={{display:'flex',gap:8,alignItems:'center'}}><input style={{width:'auto'}} type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/>Show passwords</label>
    {err&&<p className="err" role="alert">{err}</p>}
    <button className="btn" disabled={busy}>{busy?'Please wait…':reg?'Create account':'Log in'}</button>
    <button type="button" className="btn ghost" onClick={()=>{setReg(!reg);setErr('')}}>{reg?'I already have an account':'Create an account'}</button></form></div>;}

function Dashboard({user,openNew}){
  const [s,setS]=useState(null),[err,setErr]=useState('');
  useEffect(()=>{api('/dashboard/summary').then(setS).catch(e=>setErr(e.message))},[]);
  if(err)return <p className="err">{err}</p>;if(!s)return <p className="mute">Loading…</p>;
  const cards=[['Total',s.total],['Completed',s.completed],['In progress',s.inProgress],['Pending',s.pending],['Overdue',s.overdue]];
  return <div style={{display:'grid',gap:16}}>
    <div className="row between"><div><h1>Hello, {user.name.split(' ')[0]}</h1><p className="mute">{new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p></div>
      <button className="btn" onClick={openNew}>Create task</button></div>
    <div className="grid">{cards.map(([k,v])=><div className="card stat" key={k}><span className="mute">{k}</span><b className={k==='Overdue'&&v?'late':''}>{v}</b></div>)}</div>
    <div className="card"><div className="row between"><h2>Completion rate</h2><span>{s.rate}% ({s.completed} of {s.total})</span></div>
      <div className="bar" role="progressbar" aria-valuenow={s.rate} aria-valuemin="0" aria-valuemax="100"><i style={{width:s.rate+'%'}}/></div></div>
    <div className="card"><h2>Completed in the last 7 days</h2>
      {s.week.every(d=>!d.count)?<p className="mute">No tasks completed this week yet.</p>:
      <div style={{height:220}}><ResponsiveContainer><BarChart data={s.week.map(d=>({...d,day:d.date.slice(5)}))}><XAxis dataKey="day" stroke="#A7B0BA"/><YAxis allowDecimals={false} stroke="#A7B0BA"/>
        <Tooltip contentStyle={{background:'#0B2D45',border:'1px solid #234'}}/><Bar dataKey="count" name="Completed" fill="#34a883" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>}</div></div>;}

function TaskForm({task,cats,onClose,onSaved}){
  const [f,setF]=useState({title:task?.title||'',description:task?.description||'',status:task?.status||'pending',priority:task?.priority||'medium',
    dueDate:task?.dueDate?task.dueDate.slice(0,10):'',categoryId:task?.categoryId||'',tags:(task?.tags||[]).join(', ')});
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false);const set=k=>e=>setF({...f,[k]:e.target.value});
  async function save(e){e.preventDefault();if(busy)return;setBusy(true);setErr('');
    const body={title:f.title,description:f.description,status:f.status,priority:f.priority,dueDate:f.dueDate||null,categoryId:f.categoryId||null,tags:f.tags.split(',').map(t=>t.trim()).filter(Boolean)};
    try{await api(task?'/tasks/'+task._id:'/tasks',{method:task?'PATCH':'POST',body});onSaved(task?'Task updated':'Task created')}catch(x){setErr(x.message);setBusy(false)}}
  return <div className="modal" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form onSubmit={save} role="dialog" aria-label="Task form">
    <h2>{task?'Edit task':'New task'}</h2>
    <label>Title<input autoFocus required maxLength={200} value={f.title} onChange={set('title')}/></label>
    <label>Description<textarea rows={3} value={f.description} onChange={set('description')}/></label>
    <div className="row"><label style={{flex:1}}>Status<select value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label style={{flex:1}}>Priority<select value={f.priority} onChange={set('priority')}>{['low','medium','high','urgent'].map(p=><option key={p}>{p}</option>)}</select></label></div>
    <div className="row"><label style={{flex:1}}>Due date<input type="date" value={f.dueDate} onChange={set('dueDate')}/></label>
      <label style={{flex:1}}>Category<select value={f.categoryId} onChange={set('categoryId')}><option value="">None</option>{cats.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label></div>
    <label>Tags (comma separated)<input value={f.tags} onChange={set('tags')}/></label>
    {err&&<p className="err" role="alert">{err}</p>}
    <div className="row between"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy}>{busy?'Saving…':'Save task'}</button></div></form></div>;}

function Tasks({cats,openEdit,reload,toast,tick}){
  const [q,setQ]=useState(''),[fl,setFl]=useState({status:'',priority:'',category:'',overdue:'',sort:'due'}),[view,setView]=useState('list'),[items,setItems]=useState(null),[err,setErr]=useState('');
  const load=useCallback(()=>{const p=new URLSearchParams({q,...fl});setErr('');
    api('/tasks?'+p).then(d=>setItems(d.tasks)).catch(e=>setErr(e.message))},[q,fl,tick]);
  useEffect(()=>{const t=setTimeout(load,200);return()=>clearTimeout(t)},[load]);
  const active=Object.entries(fl).filter(([k,v])=>v&&k!=='sort').length+(q?1:0);
  async function move(t,status){try{await api('/tasks/'+t._id,{method:'PATCH',body:{status}});load();reload()}catch(e){toast(e.message,true)}}
  async function del(t){if(!confirm(`Delete "${t.title}"? This cannot be undone.`))return;
    try{await api('/tasks/'+t._id,{method:'DELETE'});toast('Task deleted');load();reload()}catch(e){toast(e.message,true)}}
  const Row=({t})=><div className={'task'+(t.status==='completed'?' done':'')}><div><button className="t" onClick={()=>openEdit(t)}>{t.title}</button>
    <div className="mute"><span className={'p-'+t.priority}>● {t.priority}</span> · <span className={late(t)?'late':''}>{late(t)?'Overdue · ':''}{fmt(t.dueDate)}</span>{cats.find(c=>c._id===t.categoryId)&&' · '+cats.find(c=>c._id===t.categoryId).name}
    {t.tags.map(g=><span key={g} className="tag" style={{marginLeft:6}}>{g}</span>)}</div></div>
    <div className="row"><select aria-label="Status" value={t.status} onChange={e=>move(t,e.target.value)}>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <button className="btn danger" onClick={()=>del(t)}>Delete</button></div></div>;
  const sel=(k,opts,label)=><select aria-label={label} value={fl[k]} onChange={e=>setFl({...fl,[k]:e.target.value})}><option value="">{label}</option>{opts}</select>;
  return <div style={{display:'grid',gap:14}}>
    <div className="row"><input placeholder="Search tasks…" aria-label="Search" value={q} onChange={e=>setQ(e.target.value)} style={{flex:1,minWidth:180}}/>
      {sel('status',Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>),'Any status')}
      {sel('priority',['low','medium','high','urgent'].map(p=><option key={p}>{p}</option>),'Any priority')}
      {sel('category',cats.map(c=><option key={c._id} value={c._id}>{c.name}</option>),'Any category')}
      <select aria-label="Sort" value={fl.sort} onChange={e=>setFl({...fl,sort:e.target.value})}><option value="due">Due date</option><option value="created">Newest</option><option value="updated">Recently updated</option><option value="title">A–Z</option></select>
      <label style={{display:'flex',flexDirection:'row',gap:6,alignItems:'center'}}><input style={{width:'auto'}} type="checkbox" checked={fl.overdue==='1'} onChange={e=>setFl({...fl,overdue:e.target.checked?'1':''})}/>Overdue only</label></div>
    <div className="row between"><span className="mute">{items?items.length+' tasks':''}{active>0&&` · ${active} filter${active>1?'s':''} active`}</span>
      <div className="row">{active>0&&<button className="btn ghost" onClick={()=>{setQ('');setFl({...fl,status:'',priority:'',category:'',overdue:''})}}>Clear filters</button>}
      {['list','kanban'].map(v=><button key={v} className={'btn '+(view===v?'':'ghost')} onClick={()=>setView(v)}>{v==='list'?'List':'Board'}</button>)}</div></div>
    {err?<p className="err">{err} <button className="btn ghost" onClick={load}>Retry</button></p>:!items?<p className="mute">Loading…</p>:
     !items.length?<div className="card mute">{active?'No tasks match these filters.':'No tasks yet. Create your first one.'}</div>:
     view==='list'?<div className="card" style={{padding:0}}>{items.map(t=><Row key={t._id} t={t}/>)}</div>:
     <div className="kanban">{Object.entries(STATUS).map(([k,v])=><div className="card" key={k}><h2>{v} <span className="mute">{items.filter(t=>t.status===k).length}</span></h2>
       {items.filter(t=>t.status===k).map(t=><div className="card" style={{background:'var(--s2)'}} key={t._id}><Row t={t}/></div>)}</div>)}</div>}</div>;}

function Categories({cats,reload,toast}){
  const [name,setName]=useState('');
  async function add(e){e.preventDefault();try{await api('/categories',{method:'POST',body:{name}});setName('');reload();toast('Category added')}catch(x){toast(x.message,true)}}
  async function del(c){if(!confirm(`Delete "${c.name}"? Its ${c.taskCount} task(s) will be kept without a category.`))return;
    try{await api('/categories/'+c._id,{method:'DELETE'});reload();toast('Category deleted')}catch(x){toast(x.message,true)}}
  return <div style={{display:'grid',gap:14}}><h1>Categories</h1>
    <form className="row" onSubmit={add}><input required maxLength={40} placeholder="New category" aria-label="Category name" value={name} onChange={e=>setName(e.target.value)}/><button className="btn">Add</button></form>
    <div className="card" style={{padding:0}}>{cats.map(c=><div className="task" key={c._id}><span>{c.name} <span className="mute">· {c.taskCount} tasks</span></span><button className="btn danger" onClick={()=>del(c)}>Delete</button></div>)}</div></div>;}

export default function App(){
  const [user,setUser]=useState(undefined),[page,setPage]=useState('dashboard'),[cats,setCats]=useState([]),[form,setForm]=useState(null),[msg,setMsg]=useState(null),[tick,setTick]=useState(0);
  const loadCats=useCallback(()=>api('/categories').then(d=>setCats(d.categories)).catch(()=>{}),[]);
  useEffect(()=>{api('/auth/me').then(d=>setUser(d.user)).catch(()=>setUser(null))},[]);
  useEffect(()=>{if(user)loadCats()},[user,loadCats,tick]);
  const toast=(text,bad)=>{setMsg({text,bad});setTimeout(()=>setMsg(null),3000)};
  const reload=()=>setTick(t=>t+1);
  if(user===undefined)return <div className="center">Loading…</div>;
  if(!user)return <Auth onAuth={setUser}/>;
  const nav=[['dashboard','Dashboard'],['tasks','My Tasks'],['categories','Categories']];
  return <div className="shell"><aside><Logo/>{nav.map(([k,v])=><button key={k} className={'nav'+(page===k?' on':'')} onClick={()=>setPage(k)}>{v}</button>)}
    <div style={{flex:1}}/><div className="mute" style={{padding:'0 12px'}}>{user.name}</div>
    <button className="nav" onClick={async()=>{await api('/auth/logout',{method:'POST'});setUser(null)}}>Log out</button></aside>
    <main key={page}>{page==='dashboard'&&<Dashboard key={tick} user={user} openNew={()=>setForm({})}/>}
      {page==='tasks'&&<><div className="row between" style={{marginBottom:14}}><h1>My Tasks</h1><button className="btn" onClick={()=>setForm({})}>Create task</button></div>
        <Tasks cats={cats} tick={tick} reload={reload} toast={toast} openEdit={t=>setForm(t)}/></>}
      {page==='categories'&&<Categories cats={cats} reload={reload} toast={toast}/>}</main>
    {form&&<TaskForm task={form._id?form:null} cats={cats} onClose={()=>setForm(null)} onSaved={m=>{setForm(null);toast(m);reload()}}/>}
    {msg&&<div role="status" className="card" style={{position:'fixed',bottom:20,right:20,zIndex:20,borderColor:msg.bad?'var(--bad)':'var(--ok)'}}>{msg.text}</div>}</div>;}
