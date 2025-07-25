'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

interface Specialty {
  id: number;
  name: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: string;
  specialties: Specialty[];
}

interface Message {
  content: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface MDT {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  patientProfile: {
    name: string;
    gender: string;
    uniqueId: string;
  } | null;
  members: {
    id: string;
    firstName: string;
    lastName: string;
    specialties: Array<{
      id: number;
      name: string;
    }>;
  }[];
  messages: {
    content: string;
    createdAt: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }[];
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [mdts, setMdts] = useState<MDT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated via NextAuth or direct API
    if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ').slice(1).join(' ') || '',
        email: session.user.email || '',
        userType: session.user.userType,
        specialties: []
      });
    } else if (status === 'unauthenticated') {
      // Check sessionStorage for direct API login
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (err) {
          console.error('Error parsing stored user:', err);
          redirect('/login');
        }
      } else {
        redirect('/login');
      }
    }
  }, [session, status]);

  useEffect(() => {
    const fetchMDTs = async () => {
      if (!user && status === 'loading') return;
      
      try {
        const response = await fetch('/api/mdts');
        if (!response.ok) {
          throw new Error('Failed to fetch MDTs');
        }
        const data = await response.json();
        setMdts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (user || status === 'authenticated') {
      fetchMDTs();
    }
  }, [user, status]);

  if ((status === 'loading' && !user) || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  const currentUser = user || session?.user;
  if (!currentUser) {
    redirect('/login');
    return null;
  }

  const isLocalUser = currentUser.userType === 'LOCAL';
  
  // Handle different user object structures
  let userName = '';
  if ('name' in currentUser && currentUser.name) {
    userName = currentUser.name;
  } else if ('firstName' in currentUser && currentUser.firstName) {
    userName = `${currentUser.firstName} ${currentUser.lastName || ''}`.trim();
  }

  const ActionButton = () => {
    if (isLocalUser) {
      return (
        <Link 
          href="/mdt/new"
                          className="text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 hover:opacity-90"
                style={{ backgroundColor: '#EA6C9D' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create New MDT
        </Link>
      );
    }
    return (
      <Link 
        href="/mdt/invites"
                        className="text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 hover:opacity-90"
                style={{ backgroundColor: '#EA6C9D' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>
        View MDT Invites
      </Link>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {isLocalUser ? 'Active MDTs' : 'Your MDT Participations'}
          </h1>
          {userName && (
            <p className="text-gray-600 mt-1">
              Welcome back, {userName}
            </p>
          )}
        </div>
        <ActionButton />
      </div>

      {mdts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mdts.map((mdt) => (
            <Link href={`/mdt/${mdt.id}`} key={mdt.id}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{mdt.name}</h3>
                      <p className="text-gray-600">Patient: {mdt.patientProfile?.name || 'Not specified'}</p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      Active
                    </span>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Team Members</h3>
                    <div className="flex flex-wrap gap-2">
                      {mdt.members.map((member) => (
                        <span
                          key={member.id}
                          className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
                          title={member.specialties.map(s => s.name).join(', ')}
                        >
                          {member.firstName} {member.lastName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {mdt.messages.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-gray-600">
                        Latest message: {mdt.messages[0].content.substring(0, 50)}
                        {mdt.messages[0].content.length > 50 ? '...' : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        by {mdt.messages[0].user.firstName} {mdt.messages[0].user.lastName} •{' '}
                        {format(new Date(mdt.messages[0].createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-blue-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">
              {isLocalUser 
                ? 'Welcome to MediBridge MDTs!'
                : 'Welcome to MediBridge!'
              }
            </h3>
            <p className="text-gray-600 mb-6">
              {isLocalUser 
                ? 'Start collaborating with other healthcare professionals by creating your first Multi-Disciplinary Team (MDT). MDTs help coordinate patient care across different specialties.'
                : 'You\'ll see your MDT invitations and participations here once you\'re invited to collaborate on patient cases.'
              }
            </p>
            <div className="space-y-4">
              <ActionButton />
              <Link 
                href="/help/mdt-guide"
                className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700 transition-colors"
              >
                Learn more about MDTs
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
