import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const localDoctors = await prisma.user.findMany({
      where: {
        userType: 'LOCAL',
        email: {
          not: session.user.email // Exclude the current user
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        specialties: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        firstName: 'asc',
      },
    });

    // Format the response
    const formattedDoctors = localDoctors.map(doctor => ({
      id: doctor.id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      email: doctor.email,
      specialties: doctor.specialties,
    }));

    return NextResponse.json(formattedDoctors);
  } catch (error) {
    console.error('Error fetching local doctors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch local doctors' },
      { status: 500 }
    );
  }
} 