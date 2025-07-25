import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { InvitationStatus } from '@prisma/client';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Get specific invitation details
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

    const invitation = await prisma.mDTInvitation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        mdtId: true,
        mdt: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            status: true,
            patientProfile: {
              select: {
                age: true,
                gender: true,
                uniqueId: true,
                medicalHistory: true,
                caseSummary: true,
                medications: {
                  select: {
                    name: true,
                    dosage: true,
                  },
                },
              }
            },
            members: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialties: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              }
            }
          }
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
            specialties: {
              select: {
                id: true,
                name: true,
              },
            },
          }
        }
      }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if the user is authorized to view this invitation
    if (invitation.mdt.members.some(member => member.id === user.id) || 
        invitation.sender.firstName) { // User is either a member or the sender
      // Allow viewing
    } else {
      // For external users, they should only see invitations sent to them
      const userInvitation = await prisma.mDTInvitation.findFirst({
        where: {
          id: params.id,
          receiverId: user.id
        }
      });

      if (!userInvitation) {
        return NextResponse.json(
          { error: 'Not authorized to view this invitation' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(invitation);
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body as { status: InvitationStatus };

    if (!['ACCEPTED', 'DECLINED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const invitation = await prisma.mDTInvitation.findUnique({
      where: { id: params.id },
      include: {
        mdt: {
          include: {
            requiredSpecialties: true
          }
        }
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.receiverId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to respond to this invitation' },
        { status: 403 }
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation has already been responded to' },
        { status: 400 }
      );
    }

    // Check if the specialty position is still available
    const requiredSpecialty = invitation.mdt.requiredSpecialties.find(
      rs => rs.specialtyId === invitation.specialtyId && !rs.filled
    );

    if (status === 'ACCEPTED' && !requiredSpecialty) {
      return NextResponse.json(
        { error: 'This specialty position has already been filled' },
        { status: 400 }
      );
    }

    // Start a transaction to update invitation, MDT membership, and handle other invitations
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      const updatedInvitation = await tx.mDTInvitation.update({
        where: { id: params.id },
        data: { status },
        include: {
          mdt: {
            select: {
              name: true,
              patientProfile: {
                select: {
                  age: true
                }
              }
            },
          },
        },
      });

      if (status === 'ACCEPTED') {
        // Add user to MDT members
        await tx.mDT.update({
          where: { id: invitation.mdtId },
          data: {
            members: {
              connect: { id: user.id },
            },
          },
        });

        // Mark the specialty as filled
        await tx.mDTSpecialty.update({
          where: {
            mdtId_specialtyId: {
              mdtId: invitation.mdtId,
              specialtyId: invitation.specialtyId!
            }
          },
          data: { filled: true }
        });

        // Cancel other pending invitations for the same specialty
        await tx.mDTInvitation.updateMany({
          where: {
            mdtId: invitation.mdtId,
            specialtyId: invitation.specialtyId,
            status: 'PENDING',
            id: { not: params.id }
          },
          data: { status: 'CANCELLED' }
        });
      }

      return updatedInvitation;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to update invitation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const invitation = await prisma.mDTInvitation.findUnique({
      where: { id: params.id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.senderId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this invitation' },
        { status: 403 }
      );
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot cancel a non-pending invitation' },
        { status: 400 }
      );
    }

    await prisma.mDTInvitation.update({
      where: { id: params.id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    );
  }
} 