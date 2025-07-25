import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const mdt = await prisma.mDT.findFirst({
      where: {
        id: params.id,
        members: {
          some: {
            id: user.id
          }
        }
      },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userType: true,
            specialties: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5,
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        patientProfile: {
          include: {
            medications: {
              select: {
                id: true,
                name: true,
                dosage: true,
              },
            },
          }
        },
        requiredSpecialties: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        }
      }
    });

    if (!mdt) {
      return NextResponse.json({ error: 'MDT not found' }, { status: 404 });
    }

    return NextResponse.json(mdt);
  } catch (error) {
    console.error('Error fetching MDT:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MDT' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if the user is the creator of this MDT
    const existingMDT = await prisma.mDT.findFirst({
      where: {
        id: params.id,
        creatorId: user.id,
      }
    });

    if (!existingMDT) {
      return NextResponse.json({ 
        error: 'MDT not found or you do not have permission to edit it' 
      }, { status: 404 });
    }

    const body = await request.json();
    
    // Update MDT and patient profile
    const updatedMDT = await prisma.mDT.update({
      where: { id: params.id },
      data: {
        name: body.name,
        patientProfile: {
          update: {
            age: body.patientProfile?.age,
            uniqueId: body.patientProfile?.uniqueId,
            gender: body.patientProfile?.gender,
            medicalHistory: body.patientProfile?.medicalHistory,
            caseSummary: body.patientProfile?.caseSummary,
          }
        }
      },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            userType: true,
            specialties: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 5,
          select: {
            id: true,
            content: true,
            createdAt: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        patientProfile: {
          include: {
            medications: {
              select: {
                id: true,
                name: true,
                dosage: true,
              },
            },
          }
        },
        requiredSpecialties: {
          include: {
            specialty: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        }
      }
    });

    return NextResponse.json(updatedMDT);
  } catch (error) {
    console.error('Error updating MDT:', error);
    return NextResponse.json(
      { error: 'Failed to update MDT' },
      { status: 500 }
    );
  }
} 