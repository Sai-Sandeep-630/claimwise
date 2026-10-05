import { NextResponse } from 'next/server';
import { appURL, sameOrigin } from '@/lib/auth';
import { COOKIE, constantEqual, signSession } from '@/lib/session';
export const runtime='nodejs';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(request:Request) {
  if(!sameOrigin(request))return new Response('Invalid origin',{status:403});
  const secret=process.env.SESSION_SECRET,password=process.env.REVIEWER_PASSWORD;
  if(!secret||secret.length<32||!password||password.length<12)return new Response('Set SESSION_SECRET (32+ characters) and REVIEWER_PASSWORD (12+ characters) on the server.',{status:503});
  // Best-effort per-process throttle; use a single instance for this demo.
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'local';
  const now=Date.now();
  for(const [key,value] of attempts)if(value.until<=now)attempts.delete(key);
  if(attempts.size>10000)return new Response('Try again later.',{status:429});
  const state=attempts.get(ip)??{count:0,until:now+15*60*1000};
  if(state.count>=15)return new Response('Too many attempts. Try again in 15 minutes.',{status:429});
  const raw=await request.text();
  if(raw.length>4096)return new Response('Request too large',{status:413});
  const supplied=new URLSearchParams(raw).get('password')||'';
  if(!constantEqual(supplied,password)){
    state.count++;attempts.set(ip,state);
    console.log(JSON.stringify({event:'login_failed'}));
    return NextResponse.redirect(new URL('/login?error=invalid',appURL(request)),303);
  }
  attempts.delete(ip);
  const response=NextResponse.redirect(new URL('/',appURL(request)),303);
  response.cookies.set(COOKIE,signSession(secret),{httpOnly:true,secure:new URL(appURL(request)).protocol==='https:',sameSite:'lax',path:'/',maxAge:8*60*60});
  console.log(JSON.stringify({event:'login_success'}));
  return response;
}
