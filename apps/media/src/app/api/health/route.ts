import { NextResponse } from 'next/server';
import { isStorageConfigured } from '@/lib/s3';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'media',
    storageConfigured: isStorageConfigured(),
  });
}
