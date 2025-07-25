import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import * as z from 'zod';
import { prisma } from '../../../lib/prisma';

// Base validation schema
const baseSignUpSchema = {
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  specialties: z.array(z.string()),
  userType: z.enum(['LOCAL', 'EXTERNAL']),
};

// Extended schema for local users
const localSignUpSchema = z.object({
  ...baseSignUpSchema,
  hospital: z.string().min(1),
  referralCode: z.string().min(1),
});

// Schema for external users
const externalSignUpSchema = z.object({
  ...baseSignUpSchema,
  professionalRegistrationNumber: z.string().min(1),
});

// Infer types from schemas
type LocalSignUpData = z.infer<typeof localSignUpSchema>;
type ExternalSignUpData = z.infer<typeof externalSignUpSchema>;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate based on user type and infer correct type
    const validatedData: LocalSignUpData | ExternalSignUpData = body.userType === 'LOCAL'
      ? localSignUpSchema.parse(body)
      : externalSignUpSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Convert specialty IDs from strings to numbers
    const specialtyIds = validatedData.specialties.map(id => parseInt(id, 10));

    // Base user data
    const userData = {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      password: hashedPassword,
      userType: validatedData.userType,
      specialties: {
        connect: specialtyIds.map(id => ({ id }))
      }
    };

    // Handle user type specific data
    if (validatedData.userType === 'LOCAL') {
      // Type assertion to access referralCode and hospital
      const localData = validatedData as LocalSignUpData;
      
      // For local users, validate referral code and set up the relationship
      const referrer = await prisma.user.findUnique({
        where: { referralCode: localData.referralCode },
        select: {
          id: true,
          userType: true,
        },
      });

      if (!referrer || referrer.userType !== 'EXTERNAL') {
        return NextResponse.json(
          { error: 'Invalid referral code' },
          { status: 400 }
        );
      }

      // Add referral relationship and hospital
      Object.assign(userData, {
        hospital: localData.hospital,
        referredBy: {
          connect: { id: referrer.id }
        }
      });
    } else {
      // Type assertion to access professionalRegistrationNumber
      const externalData = validatedData as ExternalSignUpData;
      
      // For external users, generate a referral code and add professional registration number
      Object.assign(userData, {
        professionalRegistrationNumber: externalData.professionalRegistrationNumber,
        referralCode: await generateUniqueReferralCode()
      });
    }

    // Create user
    const user = await prisma.user.create({
      data: userData,
      include: {
        specialties: true,
        referredBy: validatedData.userType === 'LOCAL' ? {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            referralCode: true,
          }
        } : false,
        referredUsers: validatedData.userType === 'EXTERNAL' ? {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        } : false,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { 
        message: 'User created successfully',
        user: userWithoutPassword
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Signup error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

async function generateUniqueReferralCode(): Promise<string> {
  const length = 8;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code: string;
  let isUnique = false;

  while (!isUnique) {
    code = Array.from(
      { length },
      () => chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');

    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
    });

    if (!existing) {
      isUnique = true;
      return code;
    }
  }

  throw new Error('Failed to generate unique referral code');
} 