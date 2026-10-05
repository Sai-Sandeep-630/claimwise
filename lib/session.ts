import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
export const COOKIE = 'claimwise_session';
export function constantEqual(a:string,b:string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
}
function signature(value:string,secret:string){return createHmac('sha256',secret).update(value).digest('base64url');}
export function signSession(secret:string,now=Date.now()) {
  const value = Buffer.from(JSON.stringify({role:'reviewer',expires:now+8*60*60*1000})).toString('base64url');
  return `${value}.${signature(value,secret)}`;
}
export function validSession(token:string,secret:string,now=Date.now()) {
  try {
    const [value,sig,...extra]=token.split('.');
    if(!value||!sig||extra.length||!constantEqual(sig,signature(value,secret)))return false;
    const payload=JSON.parse(Buffer.from(value,'base64url').toString());
    return payload.role==='reviewer'&&typeof payload.expires==='number'&&payload.expires>now;
  } catch {return false;}
}
