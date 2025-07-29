import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/database';
import { EnhancedDatabaseService } from '@/lib/database-enhanced';

// Returns: { meetingCount: number, fileCount: number }
export async function GET(req: NextRequest, { params }: { params: { clubId: string } }) {
  const clubId = params.clubId;
  // Meeting count
  const meetingsRes = await DatabaseService.getMeetings({ clubId }, { limit: 1, page: 1 });
  // File count
  const filesRes = await EnhancedDatabaseService.getFiles({ limit: 1, page: 1, filters: { club_id: clubId } });
  return NextResponse.json({
    meetingCount: meetingsRes.pagination?.total ?? 0,
    fileCount: filesRes.pagination?.total ?? 0,
  });
}
