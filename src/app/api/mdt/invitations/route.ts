import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { InvitationStatus } from '@prisma/client';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Get invitations for the current user
export async function GET(request: Request) {
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

    const invitations = await prisma.mDTInvitation.findMany({
      where: {
        receiverId: user.id,
        status: 'PENDING'
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        mdtId: true,
        mdt: {
          select: {
            id: true,
            name: true,
            patientProfile: {
              select: {
                age: true,
                gender: true,
                uniqueId: true
              }
            },
            members: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialties: true
              }
            }
          }
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
            specialties: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

// Create a new invitation
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { mdtId, receiverEmail } = body;

    const sender = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    if (sender.userType !== 'LOCAL') {
      return NextResponse.json(
        { error: 'Only local users can send invitations' },
        { status: 403 }
      );
    }

    const receiver = await prisma.user.findUnique({
      where: { email: receiverEmail },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: 'Receiver not found' },
        { status: 404 }
      );
    }

    const existingInvitation = await prisma.mDTInvitation.findFirst({
      where: {
        mdtId,
        receiverId: receiver.id,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'Invitation already exists' },
        { status: 400 }
      );
    }

    const invitation = await prisma.mDTInvitation.create({
      data: {
        mdtId,
        senderId: sender.id,
        receiverId: receiver.id,
      },
      include: {
        mdt: {
          select: {
            name: true,
            patientProfile: {
              select: {
                age: true,
                gender: true,
                uniqueId: true
              }
            }
          }
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        receiver: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
} 

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { invitationId, status } = body;

    // Update invitation status
    const invitation = await prisma.mDTInvitation.update({
      where: {
        id: invitationId,
        receiverId: user.id,
      },
      data: {
        status,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        mdtId: true,
        mdt: {
          select: {
            id: true,
            name: true,
            patientProfile: {
              select: {
                age: true,
                gender: true,
                uniqueId: true
              }
            },
            members: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialties: true
              }
            }
          }
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
            specialties: true
          }
        }
      }
    });

    // If invitation was accepted, add user to MDT members
    if (status === 'ACCEPTED') {
      await prisma.mDT.update({
        where: { id: invitation.mdtId },
        data: {
          members: {
            connect: { id: user.id }
          }
        }
      });
    }

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error updating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    );
  }
} 