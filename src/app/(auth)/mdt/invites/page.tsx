'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

interface Specialty {
  id: number;
  name: string;
}

interface User {
  firstName: string;
  lastName: string;
  specialties: Specialty[];
}

interface MDT {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  patientProfile: {
    age: number;
    gender: string;
    uniqueId: string;
  } | null;
}

interface Invitation {
  id: string;
  status: string;
  createdAt: string;
  mdt: MDT;
  sender: {
    firstName: string;
    lastName: string;
  };
}

export default function MDTInvites() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const response = await fetch('/api/mdt/invitations');
        if (!response.ok) {
          throw new Error('Failed to fetch invitations');
        }
        const data = await response.json();
        setInvitations(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchInvitations();
    }
  }, [status]);

  const handleInvitationResponse = async (invitationId: string, action: 'ACCEPTED' | 'DECLINED') => {
    setActionLoading(invitationId);
    try {
      const response = await fetch(`/api/mdt/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action }),
      });

      if (!response.ok) {
        throw new Error('Failed to update invitation');
      }

      // Update the local state to reflect the change
      setInvitations(prevInvitations =>
        prevInvitations.filter(inv => inv.id !== invitationId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to invitation');
    } finally {
      setActionLoading(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">MDT Invitations</h1>
        <p className="text-gray-600 mt-2">
          Review and respond to your MDT invitations
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {invitations.length > 0 ? (
        <div className="space-y-6">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{invitation.mdt.name}</h3>
                    <p className="text-gray-600">Patient Age: {invitation.mdt.patientProfile?.age ? `${invitation.mdt.patientProfile.age} years old` : 'Not specified'}</p>
                  </div>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                    Pending
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Invited by{' '}
                    <span className="font-medium">
                      {invitation.sender.firstName} {invitation.sender.lastName}
                    </span>
                    {/* {' '}({invitation.mdt.members.map(s => s.name).join(', ')}) */}
                  </p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(invitation.createdAt), 'MMMM d, yyyy')}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Current Team Members</h3>
                  <div className="flex flex-wrap gap-2">
                    {/* {invitation.mdt.members.map((member, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                        title={member.specialties.map(s => s.name).join(', ')}
                      >
                        {member.firstName} {member.lastName}
                      </span>
                    ))} */}
                    <span className="text-sm text-gray-500">Team members will be shown here</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Link
                    href={`/mdt/invites/${invitation.id}`}
                    className="text-white py-2 px-4 rounded-lg transition-colors text-center font-medium hover:opacity-90"
                style={{ backgroundColor: '#EA6C9D' }}
                  >
                    View Details
                  </Link>
                  <button
                    onClick={() => handleInvitationResponse(invitation.id, 'ACCEPTED')}
                    disabled={actionLoading === invitation.id}
                    className={`text-white py-2 px-4 rounded-lg transition-colors hover:opacity-90 ${
                      actionLoading === invitation.id ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    style={{ backgroundColor: '#EA6C9D' }}
                  >
                    {actionLoading === invitation.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleInvitationResponse(invitation.id, 'DECLINED')}
                    disabled={actionLoading === invitation.id}
                    className={`text-white py-2 px-4 rounded-lg transition-colors hover:opacity-90 ${
                      actionLoading === invitation.id ? 'opacity-75 cursor-not-allowed' : ''
                    }`}
                    style={{ backgroundColor: '#EA6C9D' }}
                  >
                    {actionLoading === invitation.id ? 'Declining...' : 'Decline'}
                  </button>
                  <div className="flex items-center justify-center">
                    <span className="text-sm text-gray-500">
                      ID: {invitation.mdt.patientProfile?.uniqueId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-blue-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Pending Invitations</h3>
            <p className="text-gray-600">
              You don&apos;t have any pending MDT invitations at the moment.
              When someone invites you to join an MDT, it will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 