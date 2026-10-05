import {NextResponse} from 'next/server';
import {appURL} from '@/lib/auth';
import {COOKIE} from '@/lib/session';
export async function GET(request:Request){const response=NextResponse.redirect(new URL('/login',appURL(request)));response.cookies.set(COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return response;}
