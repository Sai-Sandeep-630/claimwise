import {redirect} from 'next/navigation';
import {getReviewer} from '@/lib/auth';
import Dashboard from './Dashboard';
export const dynamic='force-dynamic';
export default async function Page(){if(!await getReviewer())redirect('/login');return <Dashboard/>;}
