import {createHash,timingSafeEqual} from 'node:crypto';
import pg from 'pg';
let pool;
const digest=s=>createHash('sha256').update(s).digest();
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'no-referrer','Content-Type':'text/html; charset=utf-8'};
export function authorized(header,password){return typeof password==='string'&&password.length>=24&&typeof header==='string'&&timingSafeEqual(digest(header),digest('Basic '+Buffer.from('owner:'+password).toString('base64')));}
export default async function(req){
 if(req.method!=='GET')return new Response('Use GET',{status:405,headers});
 if(!authorized(req.headers.get('authorization'),process.env.WEBADI_ADMIN_PASSWORD))return new Response('Owner sign-in required',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Webadi inquiries", charset="UTF-8"'}});
 const p=new URL(req.url).searchParams.get('before');
 if(p&&!/^[1-9]\d{0,17}$/.test(p)) return new Response('Invalid page',{status:400,headers});
 try {
  if(!process.env.DATABASE_URL)throw new Error();
  const db=pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2,connectionTimeoutMillis:4000});
  const {rows}=await db.query('SELECT i.id,i.name,i.email,i.organization,i.website,i.goal,i.timing,i.created_at,b.starts_at FROM webadi_inquiries i LEFT JOIN webadi_bookings b ON b.inquiry_id=i.id WHERE ($1::bigint IS NULL OR i.id<$1) ORDER BY i.id DESC LIMIT 51',[p]);
  const time=d=>d?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date(d))+' ET':'—';
  const body=rows.slice(0,50).map(r=>'<tr>'+[time(r.created_at),r.name,r.email,r.organization,r.website,r.goal,r.timing,time(r.starts_at)].map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>').join('');
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Webadi inquiries</title><style>body{font:1rem system-ui;margin:2rem;color:#181818}section{overflow:auto}table{width:100%;border-collapse:collapse}td,th{padding:.65rem;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere}</style><h1>Project inquiries</h1>${body?'<section><table><thead><tr>'+['Received','Name','Email','Organization','Website','Project goal','Launch timing','Consultation'].map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></section>':'<p>No inquiries on this page.</p>'}${rows.length>50?'<p><a href="?before='+h(rows[49].id)+'">Older inquiries</a></p>':''}${p?'<p><a href="?">Newest inquiries</a></p>':''}</html>`,{headers});
 } catch {return new Response('Inquiries are temporarily unavailable.',{status:503,headers});}
}
