import { cookies } from 'next/headers';
import { COOKIE, validSession } from './session';
export async function getReviewer() {
  const secret=process.env.SESSION_SECRET;
  if(!secret||secret.length<32||!process.env.REVIEWER_PASSWORD||process.env.REVIEWER_PASSWORD.length<12)return null;
  const token=(await cookies()).get(COOKIE)?.value;
  return token&&validSession(token,secret)?{userId:'demo-reviewer',email:'Demo reviewer'}:null;
}
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin');
  if(!origin)return true;
  try{return new URL(origin).origin===new URL(process.env.APP_URL||request.url).origin;}catch{return false;}
}
export function appURL(request:Request){return process.env.APP_URL||new URL(request.url).origin;}
