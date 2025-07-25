import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

// Get messages for a specific MDT
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

    // Check if user is a member of the MDT
    const mdt = await prisma.mDT.findUnique({
      where: { id: params.id },
      include: {
        members: {
          select: { id: true }
        }
      }
    });

    if (!mdt) {
      return NextResponse.json({ error: 'MDT not found' }, { status: 404 });
    }

    const isMember = mdt.members.some(member => member.id === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: 'Not authorized to view messages for this MDT' },
        { status: 403 }
      );
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: { mdtId: params.id },
      include: {
        user: {
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
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// Send a new message
export async function POST(
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

    const body = await request.json();
    const { content, messageType = 'TEXT' } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: 'Message content is too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Check if user is a member of the MDT
    const mdt = await prisma.mDT.findUnique({
      where: { id: params.id },
      include: {
        members: {
          select: { id: true }
        }
      }
    });

    if (!mdt) {
      return NextResponse.json({ error: 'MDT not found' }, { status: 404 });
    }

    const isMember = mdt.members.some(member => member.id === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: 'Not authorized to send messages to this MDT' },
        { status: 403 }
      );
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        userId: user.id,
        mdtId: params.id,
      },
      include: {
        user: {
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
          },
        },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
} 