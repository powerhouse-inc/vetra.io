import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.NEXT_PUBLIC_BUILD_ID || process.env.npm_package_version || 'dev',
    },
    { status: 200 },
  )
}
