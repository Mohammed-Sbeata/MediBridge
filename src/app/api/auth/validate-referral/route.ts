import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find user with this referral code
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: {
        id: true,
        userType: true,
      },
    });

    if (!referrer) {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // Ensure the referrer is an external healthcare professional
    if (referrer.userType !== 'EXTERNAL') {
      return NextResponse.json(
        { error: 'Invalid referral code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error validating referral code:', error);
    return NextResponse.json(
      { error: 'Failed to validate referral code' },
      { status: 500 }
    );
  }
} 