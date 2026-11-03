import { NextRequest, NextResponse } from 'next/server';
import { getTeamMember } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

/** The signed-in team member and the admin screens they may open. */
export async function GET(request: NextRequest) {
  const member = await getTeamMember(request);
  if (!member) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  return NextResponse.json(member, { headers: { 'Cache-Control': 'no-store' } });
}
