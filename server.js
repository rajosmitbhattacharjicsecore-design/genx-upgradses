const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET = process.env.CAMPUSHUB_SECRET || 'campushub-development-secret-change-me';

const seedEvents = [
{id:'e1',title:'Tech Club Orientation',cat:'Club Event',date:'2026-09-20T10:00',club:'Tech Club',loc:'Seminar Hall',desc:'Meet the team, discover projects and join campus tech communities.',urgent:false,created:'2026-09-10T08:00:00.000Z'},
{id:'e2',title:'AI & Machine Learning Bootcamp',cat:'Workshop',date:'2026-09-22T14:00',club:'AI Society',loc:'Innovation Lab',desc:'A practical beginner-friendly workshop on AI, ML and model building.',urgent:false,created:'2026-09-11T08:00:00.000Z'},
{id:'e3',title:'CodeSprint 2026',cat:'Competition',date:'2026-09-27T09:00',club:'Coding Club',loc:'Computer Centre',desc:'A fast-paced campus coding competition with team and solo rounds.',urgent:false,created:'2026-09-12T08:00:00.000Z'},
{id:'e4',title:'Scholarship Form Deadline',cat:'Notice',date:'2026-09-19T17:00',club:'Student Affairs',loc:'Student Office',desc:'Final date for submitting the current scholarship application forms.',urgent:true,created:'2026-09-13T08:00:00.000Z'},
{id:'e5',title:'Photography Walk',cat:'Club Event',date:'2026-09-24T16:00',club:'Photography Club',loc:'Main Gate',desc:'An evening photo walk around the campus with peer photographers.',urgent:false,created:'2026-09-13T09:00:00.000Z'},
{id:'e6',title:'Cybersecurity Fundamentals',cat:'Workshop',date:'2026-09-29T11:00',club:'Cyber Cell',loc:'Lab 3',desc:'Learn practical cyber hygiene, common attacks and defensive basics.',urgent:false,created:'2026-09-13T10:00:00.000Z'},
{id:'e7',title:'Inter-College Hackathon',cat:'Competition',date:'2026-10-03T09:00',club:'Innovation Cell',loc:'Auditorium',desc:'Build, pitch and demo a solution to a real campus or community problem.',urgent:false,created:'2026-09-14T08:00:00.000Z'},
{id:'e8',title:'Campus Maintenance Notice',cat:'Notice',date:'2026-09-21T08:00',club:'Administration',loc:'Main Campus',desc:'Some campus facilities will have restricted access during scheduled maintenance.',urgent:true,created:'2026-09-14T09:00:00.000Z'},
{id:'e9',title:'Design Thinking Workshop',cat:'Workshop',date:'2026-10-07T15:00',club:'Design Club',loc:'Design Studio',desc:'Learn user research, ideation, prototyping and testing through a hands-on session.',urgent:false,created:'2026-09-14T10:00:00.000Z'}
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return {salt, hash:crypto.scryptSync(password,salt,64).toString('hex')}; }
function verifyPassword(password,u) { const h=crypto.scryptSync(password,u.salt,64); const expected=Buffer.from(u.hash,'hex'); return h.length===expected.length && crypto.timingSafeEqual(h,expected); }
function safeUser(u){return {id:u.id,name:u.name,role:u.role};}
function ensureDb(){
  fs.mkdirSync(DATA_DIR,{recursive:true});
  let db;
  try{db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{db=null;}
  if(!db || !Array.isArray(db.users) || db.users.length===0){
    const a=hashPassword('student123'),b=hashPassword('genx123');
    db={users:[{id:'STUDENT01',name:'Demo Student',role:'student',...a},{id:'FACULTY01',name:'Faculty Admin',role:'faculty',...b}],events:seedEvents,registrations:[],queries:[]};
    writeDb(db);
  } else {
    db.events=Array.isArray(db.events)?db.events:[]; db.registrations=Array.isArray(db.registrations)?db.registrations:[]; db.queries=Array.isArray(db.queries)?db.queries:[];
    if(db.events.length===0){db.events=seedEvents;writeDb(db);}
  }
}
function readDb(){ensureDb();return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}
function writeDb(db){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2));}
function tokenFor(user){const p=Buffer.from(JSON.stringify({sub:user.id,exp:Date.now()+7*86400000})).toString('base64url');const s=crypto.createHmac('sha256',SECRET).update(p).digest('base64url');return p+'.'+s;}
function getUser(req){
  const h=req.headers.authorization||''; if(!h.startsWith('Bearer '))return null; const t=h.slice(7),parts=t.split('.'); if(parts.length!==2)return null;
  const [p,s]=parts,expected=crypto.createHmac('sha256',SECRET).update(p).digest('base64url'); if(s.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return null;
  let payload;try{payload=JSON.parse(Buffer.from(p,'base64url').toString())}catch{return null;} if(payload.exp<Date.now())return null;
  return readDb().users.find(u=>u.id===payload.sub)||null;
}
function send(res,status,data,headers={}){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(body);}
function text(res,status,msg){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(msg);}
function parseBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)reject(new Error('Payload too large'))});req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s))}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)});}
function requireAuth(req,res){const u=getUser(req);if(!u){send(res,401,{error:'Authentication required'});return null}return u;}
function faculty(req,res){const u=requireAuth(req,res);if(!u)return null;if(u.role!=='faculty'){send(res,403,{error:'Faculty access required'});return null}return u;}
function cleanEvent(b,old={}){const title=String(b.title??old.title??'').trim(),cat=String(b.cat??old.cat??'Club Event'),date=String(b.date??old.date??'').trim(),club=String(b.club??old.club??'').trim(),loc=String(b.loc??old.loc??'').trim(),desc=String(b.desc??old.desc??'').trim();if(!title||!date||!club||!loc||!desc)throw Error('Title, date, organiser, location and description are required');if(!['Club Event','Workshop','Competition','Notice'].includes(cat))throw Error('Invalid category');if(Number.isNaN(Date.parse(date)))throw Error('Invalid date');return {title,cat,date,club,loc,desc,urgent:Boolean(b.urgent??old.urgent)};}

async function api(req,res,url){
  const method=req.method,pathName=url.pathname;
  if(method==='GET'&&pathName==='/api/health')return send(res,200,{ok:true,service:'CampusHub API'});
  if(method==='POST'&&pathName==='/api/auth/login'){const b=await parseBody(req),id=String(b.id||'').trim(),pw=String(b.password||''),db=readDb(),u=db.users.find(x=>x.id.toLowerCase()===id.toLowerCase());if(!u||!verifyPassword(pw,u))return send(res,401,{error:'Invalid credentials'});return send(res,200,{token:tokenFor(u),user:safeUser(u)});}
  if(method==='POST'&&pathName==='/api/auth/signup'){const b=await parseBody(req),id=String(b.id||'').trim(),name=String(b.name||'').trim(),pw=String(b.password||''),role=b.role==='faculty'?'faculty':'student';if(!/^[A-Za-z0-9_-]{3,30}$/.test(id))return send(res,400,{error:'Campus ID must be 3–30 letters, numbers, _ or -'});if(name.length<2)return send(res,400,{error:'Please enter your full name'});if(pw.length<6)return send(res,400,{error:'Password must be at least 6 characters'});const db=readDb();if(db.users.some(x=>x.id.toLowerCase()===id.toLowerCase()))return send(res,409,{error:'Campus ID already exists'});const u={id,name,role,...hashPassword(pw)};db.users.push(u);writeDb(db);return send(res,201,{token:tokenFor(u),user:safeUser(u)});}
  if(method==='GET'&&pathName==='/api/me'){const u=requireAuth(req,res);if(!u)return;return send(res,200,{user:safeUser(u)});}
  if(method==='GET'&&pathName==='/api/events'){return send(res,200,{events:readDb().events});}
  if(method==='GET'&&pathName==='/api/stats'){const db=readDb();return send(res,200,{events:db.events.length,registrations:db.registrations.length,questions:db.queries.length,unanswered:db.queries.filter(q=>!q.answer).length});}
  if(method==='GET'&&pathName==='/api/registrations'){const u=requireAuth(req,res);if(!u)return;return send(res,200,{registrations:readDb().registrations.filter(r=>r.userId===u.id)});}
  if(method==='POST'&&pathName==='/api/events'){const u=faculty(req,res);if(!u)return;try{const b=await parseBody(req),db=readDb(),e={id:'e'+Date.now()+crypto.randomBytes(3).toString('hex'),...cleanEvent(b),created:new Date().toISOString()};db.events.push(e);writeDb(db);return send(res,201,{event:e})}catch(e){return send(res,400,{error:e.message})}}
  const em=pathName.match(/^\/api\/events\/([^/]+)$/);if(em){const id=decodeURIComponent(em[1]);if(method==='PATCH'){const u=faculty(req,res);if(!u)return;try{const db=readDb(),i=db.events.findIndex(e=>e.id===id);if(i<0)return send(res,404,{error:'Event not found'});db.events[i]={...db.events[i],...cleanEvent(await parseBody(req),db.events[i]),updated:new Date().toISOString()};writeDb(db);return send(res,200,{event:db.events[i]})}catch(e){return send(res,400,{error:e.message})}}
    if(method==='DELETE'){const u=faculty(req,res);if(!u)return;const db=readDb();if(!db.events.some(e=>e.id===id))return send(res,404,{error:'Event not found'});db.events=db.events.filter(e=>e.id!==id);db.registrations=db.registrations.filter(r=>r.eventId!==id);writeDb(db);return send(res,200,{ok:true});}}
  const rm=pathName.match(/^\/api\/events\/([^/]+)\/register$/);if(rm){const id=decodeURIComponent(rm[1]),u=requireAuth(req,res);if(!u)return;if(u.role!=='student')return send(res,403,{error:'Only students can register for events'});const db=readDb();if(!db.events.some(e=>e.id===id))return send(res,404,{error:'Event not found'});if(method==='POST'){if(!db.registrations.some(r=>r.userId===u.id&&r.eventId===id))db.registrations.push({userId:u.id,eventId:id,created:new Date().toISOString()});writeDb(db);return send(res,201,{registered:true});}if(method==='DELETE'){db.registrations=db.registrations.filter(r=>!(r.userId===u.id&&r.eventId===id));writeDb(db);return send(res,200,{registered:false});}}
  if(method==='GET'&&pathName==='/api/queries'){const u=requireAuth(req,res);if(!u)return;const db=readDb();return send(res,200,{queries:u.role==='faculty'?db.queries:db.queries.filter(q=>q.userId===u.id)});}
  if(method==='POST'&&pathName==='/api/queries'){const u=requireAuth(req,res);if(!u)return;const b=await parseBody(req),subject=String(b.subject||'').trim(),textValue=String(b.text||'').trim();if(subject.length<2||textValue.length<2)return send(res,400,{error:'Subject and question are required'});const db=readDb(),q={id:'q'+Date.now()+crypto.randomBytes(3).toString('hex'),userId:u.id,userName:u.name,subject,text:textValue,created:new Date().toISOString(),answer:'',answeredBy:''};db.queries.push(q);writeDb(db);return send(res,201,{query:q});}
  const qm=pathName.match(/^\/api\/queries\/([^/]+)$/);if(qm&&method==='PATCH'){const u=faculty(req,res);if(!u)return;const b=await parseBody(req),answer=String(b.answer||'').trim();if(!answer)return send(res,400,{error:'Response cannot be empty'});const db=readDb(),q=db.queries.find(x=>x.id===decodeURIComponent(qm[1]));if(!q)return send(res,404,{error:'Question not found'});q.answer=answer;q.answeredBy=u.name;q.answeredAt=new Date().toISOString();writeDb(db);return send(res,200,{query:q});}
  return send(res,404,{error:'API route not found'});
}

function serveStatic(req,res){let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/'||p==='')p='/index.html';const file=path.normalize(path.join(PUBLIC_DIR,p));if(!file.startsWith(PUBLIC_DIR))return text(res,403,'Forbidden');fs.readFile(file,(err,data)=>{if(err)return text(res,404,'Not found');const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);});}

ensureDb();
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))await api(req,res,url);else serveStatic(req,res)}catch(e){console.error(e);send(res,500,{error:'Internal server error'})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`CampusHub running on http://localhost:${PORT}`));
