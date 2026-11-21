import {randomBytes,createHash} from 'node:crypto';
import pg from 'pg';
const {Pool}=pg;
let pool;
const tz='America/New_York', day=86400000;
const fmt=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'});
const parts=d=>Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,+x.value]));
export function candidateSlots(now=new Date()){
 const t=parts(now), out=[];
 for(let i=0;i<=22;i++){
  const d=new Date(Date.UTC(t.year,t.month-1,t.day+i,12));
  if(![2,4].includes(d.getUTCDay()))continue;
  for(const m of [0,30])for(const offset of [4,5]){
   const x=new Date(+d+m*60000+offset*3600000), p=parts(x);
   if(p.day===d.getUTCDate()&&p.hour===12&&p.minute===m&&+x>=+now+2*day&&+x<=+now+21*day)out.push(x.toISOString());
  }
 }
 return out;
}
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const hash=t=>createHash('sha256').update(t).digest('hex');
const timings=['Within a month','1–3 months','3+ months','Flexible'];
export function clean(d){
 const fields=['name','email','organization','website','goal','timing'], caps=[120,254,160,500,2000,30];
 const v=fields.map(k=>typeof d[k]==='string'?d[k].trim():'');
 if(v.some((x,i)=>x.length>caps[i]||(!x&&i!==3)||x.includes('\0'))||!/^\S+@[^\s@]+\.[^\s@]+$/.test(v[1])||!timings.includes(v[5]))return null;
 if(v[3])try{if(!['https:','http:'].includes(new URL(v[3]).protocol))return null;}catch{return null;}
 return v;
}
export default async req=>{
 if(req.method!=='POST')return json(405,{message:'Use POST.'});
 if(!/^application\/json(?:;|$)/i.test(req.headers.get('content-type')||''))return json(415,{message:'Use JSON.'});
 const raw=await req.text();if(raw.length>8192)return json(413,{message:'That message is too long.'});
 let d;try{d=JSON.parse(raw);}catch{return json(400,{message:'Invalid request.'});}
 if(!d||typeof d!=='object'||Array.isArray(d))return json(400,{message:'Invalid request.'});
 try{
  if(d.action==='submit'){
   const v=clean(d);if(!v)return json(400,{message:'Check the required fields and try again.'});
   const token=randomBytes(32).toString('base64url');
   const db=pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:4000});
   await db.query('INSERT INTO webadi_inquiries(token_hash,name,email,organization,website,goal,timing) VALUES($1,$2,$3,$4,$5,$6,$7)',[hash(token),...v]);return json(201,{token});
  }
  if(!['book','view'].includes(d.action)||typeof d.token!=='string'||!/^[\w-]{43}$/.test(d.token))return json(400,{message:'Invalid booking link.'});
  const db=pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:4000});
  const {rows:[inquiry]}=await db.query('SELECT id FROM webadi_inquiries WHERE token_hash=$1',[hash(d.token)]);
  if(!inquiry)return json(404,{message:'Booking link not found.'});
  if(d.action==='view'){
   const {rows:[mine]}=await db.query('SELECT starts_at FROM webadi_bookings WHERE inquiry_id=$1',[inquiry.id]);
   if(mine)return json(200,{startsAt:mine.starts_at});
   const candidates=candidateSlots();const {rows}=await db.query('SELECT starts_at FROM webadi_bookings WHERE starts_at=ANY($1::timestamptz[])',[candidates]);
   const taken=new Set(rows.map(x=>new Date(x.starts_at).toISOString()));return json(200,{slots:candidates.filter(x=>!taken.has(x))});
  }
  if(!candidateSlots().includes(d.startsAt))return json(409,{message:'Choose an available time.'});
  const b=await db.query('INSERT INTO webadi_bookings(inquiry_id,starts_at) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING starts_at',[inquiry.id,d.startsAt]);
  return b.rowCount?json(201,{startsAt:d.startsAt}):json(409,{message:'That time was taken or this inquiry already has a booking.'});
 }catch{return json(503,{message:'Please try again or contact us on Instagram.'});}
};
