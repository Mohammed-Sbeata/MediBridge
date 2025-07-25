'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

interface Specialty {
  id: number;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  specialties: Specialty[];
}

interface PatientProfile {
  age: number;
  gender: string;
  uniqueId: string;
  medicalHistory?: string;
  caseSummary?: string;
  medications?: Array<{
    name: string;
    dosage: string;
  }>;
}

interface MDT {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  patientProfile: PatientProfile | null;
  members: User[];
}

interface Invitation {
  id: string;
  status: string;
  createdAt: string;
  mdt: MDT;
  sender: {
    firstName: string;
    lastName: string;
    specialties: Specialty[];
  };
}

export default function InvitationDetail({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/mdt/invitations/${params.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Invitation not found');
            return;
          }
          throw new Error('Failed to fetch invitation');
        }
        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchInvitation();
    }
  }, [status, params.id]);

  const handleInvitationResponse = async (action: 'ACCEPTED' | 'DECLINED') => {
    if (!invitation) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/mdt/invitations/${invitation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action }),
      });

      if (!response.ok) {
        throw new Error('Failed to update invitation');
      }

      // Redirect back to invitations list after responding
      router.push('/mdt/invites');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to invitation');
    } finally {
      setActionLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center space-x-4 mb-8">
            <Link href="/mdt/invites" className="text-blue-600 hover:text-blue-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Invitation Details</h1>
          </div>
          
          <div className="bg-red-50 text-red-700 px-6 py-4 rounded-lg border border-red-100">
            <div className="flex items-center space-x-3">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold">Error</h3>
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  const isExternalUser = session?.user?.userType === 'EXTERNAL';
  const patientProfile = invitation.mdt.patientProfile;

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link href="/mdt/invites" className="text-blue-600 hover:text-blue-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">MDT Invitation</h1>
            <p className="text-gray-600 mt-1">Review invitation details and patient information</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Invitation Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Invitation Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.916-.75M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.916-.75M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{invitation.mdt.name}</h2>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Pending Response
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Invited By</h3>
                  <div className="flex items-center space-x-3">
                    <div className="bg-gray-100 p-2 rounded-full">
                      <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {invitation.sender.firstName} {invitation.sender.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {invitation.sender.specialties.map(s => s.name).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Invitation Date</h3>
                  <p className="text-gray-900">{format(new Date(invitation.createdAt), 'MMMM d, yyyy')}</p>
                  <p className="text-sm text-gray-500">{format(new Date(invitation.createdAt), 'h:mm a')}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Team Members</h3>
                  <div className="space-y-2">
                    {invitation.mdt.members.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <div className="bg-blue-50 p-1 rounded-full">
                          <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-xs text-gray-600">
                            {member.specialties.map(s => s.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Response</h3>
              
              {isExternalUser && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-sm text-blue-800">
                    Your expertise is needed for this case.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => handleInvitationResponse('ACCEPTED')}
                  disabled={actionLoading}
                  className={`w-full text-white py-3 px-4 rounded-lg transition-colors font-medium hover:opacity-90 ${
                    actionLoading ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                  style={{ backgroundColor: '#EA6C9D' }}
                >
                  {actionLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Accept Invitation'
                  )}
                </button>
                <button
                  onClick={() => handleInvitationResponse('DECLINED')}
                  disabled={actionLoading}
                  className={`w-full text-white py-3 px-4 rounded-lg transition-colors font-medium hover:opacity-90 ${
                    actionLoading ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                  style={{ backgroundColor: '#EA6C9D' }}
                >
                  Decline Invitation
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - Patient Information */}
          <div className="lg:col-span-2">
            {patientProfile ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Patient Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
                  <div className="flex items-center space-x-4">
                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Patient ({patientProfile.age} years old)</h2>
                      <p className="text-blue-100">Patient ID: {patientProfile.uniqueId}</p>
                    </div>
                  </div>
                </div>

                {/* Patient Details */}
                <div className="p-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Age</h3>
                      <p className="text-lg text-gray-900">{patientProfile.age} years old</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Gender</h3>
                      <p className="text-lg text-gray-900 capitalize">{patientProfile.gender.toLowerCase()}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Patient ID</h3>
                      <p className="text-lg font-mono text-gray-900">{patientProfile.uniqueId}</p>
                    </div>
                  </div>

                  {/* Medical History */}
                  {patientProfile.medicalHistory && (
                    <div className="mb-8">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-red-100 p-2 rounded-lg">
                          <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Medical History</h3>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {patientProfile.medicalHistory}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Case Summary */}
                  {patientProfile.caseSummary && (
                    <div className="mb-8">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Case Summary</h3>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {patientProfile.caseSummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {patientProfile.medications && patientProfile.medications.length > 0 && (
                    <div>
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Current Medications</h3>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {patientProfile.medications.map((medication, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg border border-gray-100">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{medication.name}</h4>
                                  <p className="text-sm text-gray-600 mt-1">{medication.dosage}</p>
                                </div>
                                <div className="bg-green-50 p-1 rounded">
                                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* If no additional info */}
                  {!patientProfile.medicalHistory && !patientProfile.caseSummary && (!patientProfile.medications || patientProfile.medications.length === 0) && (
                    <div className="text-center py-8">
                      <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Limited Patient Information</h3>
                      <p className="text-gray-600">
                        Additional patient details may be discussed during the MDT meeting.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Patient Profile</h3>
                <p className="text-gray-600">
                  Patient information will be discussed during the MDT meeting.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 