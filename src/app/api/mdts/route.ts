import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

interface Medication {
  name: string;
  dosage: string;
}

interface PatientProfile {
  age: number;
  gender: 'MALE' | 'FEMALE';
  uniqueId: string;
  medicalHistory: string;
  caseSummary: string;
  medications: Medication[];
}

interface CreateMDTBody {
  name: string;
  patientProfile: PatientProfile;
  localDoctors: string[];
  requiredSpecialties: number[];
}

export async function GET() {
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

    const mdts = await prisma.mDT.findMany({
      where: {
        members: {
          some: {
            id: user.id
          }
        },
        status: 'ACTIVE'
      },
      include: {
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialties: true,
            userType: true,
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
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
            medications: true
          }
        },
        requiredSpecialties: {
          include: {
            specialty: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(mdts);
  } catch (error) {
    console.error('Error fetching MDTs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch MDTs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    if (user.userType !== 'LOCAL') {
      return NextResponse.json(
        { error: 'Only local users can create MDTs' },
        { status: 403 }
      );
    }

    const body: CreateMDTBody = await request.json();
    const { 
      name, 
      patientProfile,
      localDoctors,
      requiredSpecialties 
    } = body;

    // Create MDT and related records in a transaction
    const mdt = await prisma.$transaction(async (tx) => {
      try {
        // Create the MDT first without any relations
        const newMDT = await tx.mDT.create({
          data: {
            name,
            creatorId: user.id,
            status: 'ACTIVE',
          }
        });

        // Add members to the MDT
        await tx.mDT.update({
          where: { id: newMDT.id },
          data: {
            members: {
              connect: [
                { id: user.id },
                ...localDoctors.map((id: string) => ({ id }))
              ]
            }
          }
        });

        // Create patient profile
        await tx.patientProfile.create({
          data: {
            age: patientProfile.age,
            gender: patientProfile.gender,
            uniqueId: patientProfile.uniqueId,
            medicalHistory: patientProfile.medicalHistory,
            caseSummary: patientProfile.caseSummary,
            mdtId: newMDT.id,
            medications: {
              create: patientProfile.medications.map((med: Medication) => ({
                name: med.name,
                dosage: med.dosage
              }))
            }
          }
        });

        // Create required specialties
        await Promise.all(
          requiredSpecialties.map((specialtyId: number) =>
            tx.mDTSpecialty.create({
              data: {
                mdtId: newMDT.id,
                specialtyId: specialtyId,
                filled: false
              }
            })
          )
        );

        // Find external doctors with matching specialties
        const externalDoctors = await tx.user.findMany({
          where: {
            userType: 'EXTERNAL',
            specialties: {
              some: {
                id: {
                  in: requiredSpecialties
                }
              }
            }
          },
          include: {
            specialties: true
          }
        });

        // Create invitations for external doctors (one per doctor)
        await Promise.all(
          externalDoctors.map(doctor => {
            // Get the first matching specialty for this doctor
            const matchingSpecialty = doctor.specialties.find(specialty => 
              requiredSpecialties.includes(specialty.id)
            );
            
            return tx.mDTInvitation.create({
              data: {
                mdtId: newMDT.id,
                senderId: user.id,
                receiverId: doctor.id,
                specialtyId: matchingSpecialty?.id || null,
                status: 'PENDING'
              }
            });
          })
        );

        // Return the complete MDT with all relations
        return tx.mDT.findUnique({
          where: { id: newMDT.id },
          include: {
            members: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                specialties: true
              }
            },
            patientProfile: {
              include: {
                medications: true
              }
            },
            requiredSpecialties: {
              include: {
                specialty: true
              }
            },
            invitations: {
              include: {
                receiver: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      }
    });

    return NextResponse.json(mdt);
  } catch (error) {
    console.error('Error creating MDT:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create MDT' },
      { status: 500 }
    );
  }
} 