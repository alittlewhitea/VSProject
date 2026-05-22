import { redirect } from 'next/navigation';

export default function DashboardRedirect() {
  redirect('/studio?mode=image&workflow=text-to-image');
}

