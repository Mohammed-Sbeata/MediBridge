'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

interface Specialty {
  id: number;
  name: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
}

interface PatientProfile {
  id: string;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  uniqueId: string;
  medicalHistory: string;
  caseSummary: string;
  medications: Medication[];
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  userType: 'LOCAL' | 'EXTERNAL';
  specialties: Specialty[];
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface MDTSpecialty {
  id: string;
  specialtyId: number;
  filled: boolean;
  specialty: Specialty;
}

interface MDT {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
  creatorId: string;
  members: Member[];
  messages: Message[];
  patientProfile: PatientProfile;
  requiredSpecialties: MDTSpecialty[];
}

export default function MDTView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const mdtId = params.id as string;

  const [mdt, setMdt] = useState<MDT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<MDT>>({});

  // Get current user info
  const currentUser = session?.user;
  const isLocalUser = currentUser?.userType === 'LOCAL';
  const isMDTCreator = currentUser?.id === mdt?.creatorId;
  const canEdit = isLocalUser && isMDTCreator;

  useEffect(() => {
    const fetchMDT = async () => {
      if (!mdtId) return;

      try {
        const response = await fetch(`/api/mdts/${mdtId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch MDT');
        }
        const data = await response.json();
        setMdt(data);
        setEditData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchMDT();
    }
  }, [mdtId, status]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(mdt || {});
  };

  const handleSaveEdit = async () => {
    if (!mdt) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/mdts/${mdtId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      });

      if (!response.ok) {
        throw new Error('Failed to update MDT');
      }

      const updatedMDT = await response.json();
      setMdt(updatedMDT);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update MDT');
    } finally {
      setLoading(false);
    }
  };

  const updateEditData = (field: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updatePatientProfile = (field: string, value: any) => {
    setEditData(prev => ({
      ...prev,
      patientProfile: {
        ...prev.patientProfile,
        [field]: value
      } as any
    }));
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
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-100">
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="font-medium">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!mdt) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">MDT Not Found</h1>
            <p className="text-gray-600 mb-6">The requested MDT could not be found or you don't have permission to view it.</p>
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => updateEditData('name', e.target.value)}
                    className="text-3xl font-bold text-black bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  />
                ) : (
                  mdt.name
                )}
              </h1>
              <p className="text-gray-600 mt-1">
                Created {format(new Date(mdt.createdAt), 'MMM d, yyyy')} • 
                Status: <span className="capitalize">{mdt.status.toLowerCase()}</span>
              </p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            {/* Chat Button - Available to all team members */}
            <Link
              href={`/mdt/${mdt.id}/chat`}
                              className="px-4 py-2 text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
                style={{ backgroundColor: '#EA6C9D' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.451L3 21l2.451-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
              </svg>
              <span>Team Chat</span>
            </Link>

            {/* Edit Button - Only for local users */}
            {canEdit && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: '#EA6C9D' }}
                    >
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 text-white rounded-lg hover:opacity-90 flex items-center space-x-2"
                style={{ backgroundColor: '#EA6C9D' }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit MDT</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Patient Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Patient Age</label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={editData.patientProfile?.age || ''}
                      onChange={(e) => updatePatientProfile('age', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{mdt.patientProfile.age} years old</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.patientProfile?.uniqueId || ''}
                      onChange={(e) => updatePatientProfile('uniqueId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{mdt.patientProfile.uniqueId}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  {isEditing ? (
                    <select
                      value={editData.patientProfile?.gender || ''}
                      onChange={(e) => updatePatientProfile('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 capitalize">{mdt.patientProfile.gender.toLowerCase()}</p>
                  )}
                </div>
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Medical History</label>
                {isEditing ? (
                  <textarea
                    value={editData.patientProfile?.medicalHistory || ''}
                    onChange={(e) => updatePatientProfile('medicalHistory', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 whitespace-pre-wrap">{mdt.patientProfile.medicalHistory}</p>
                )}
              </div>
              
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Case Summary</label>
                {isEditing ? (
                  <textarea
                    value={editData.patientProfile?.caseSummary || ''}
                    onChange={(e) => updatePatientProfile('caseSummary', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 whitespace-pre-wrap">{mdt.patientProfile.caseSummary}</p>
                )}
              </div>
            </div>

            {/* Medications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Medications</h2>
              
              {mdt.patientProfile.medications.length > 0 ? (
                <div className="space-y-3">
                  {mdt.patientProfile.medications.map((medication, index) => (
                    <div key={medication.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900">{medication.name}</span>
                        <span className="text-gray-600 ml-2">({medication.dosage})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No medications recorded</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Members */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
              
              <div className="space-y-3">
                {mdt.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {member.userType === 'LOCAL' ? 'Local Team' : 'External Specialist'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {member.specialties.map(s => s.name).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Specialties */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Required Specialties</h2>
              
              <div className="space-y-2">
                {mdt.requiredSpecialties.map((reqSpec) => (
                  <div key={reqSpec.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-900">{reqSpec.specialty.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      reqSpec.filled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {reqSpec.filled ? 'Filled' : 'Needed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Messages */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Discussion</h2>
                <Link 
                  href={`/mdt/${mdt.id}/chat`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All
                </Link>
              </div>
              
              {mdt.messages && mdt.messages.length > 0 ? (
                <div className="space-y-4">
                  {mdt.messages.slice(-3).map((message) => (
                    <div key={message.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900">
                          {message.user.firstName} {message.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(message.createdAt), 'MMM d, HH:mm')}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{message.content}</p>
                    </div>
                  ))}
                  
                  <Link 
                    href={`/mdt/${mdt.id}/chat`}
                    className="w-full flex items-center justify-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                    style={{ backgroundColor: '#EA6C9D' }}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                    Join Discussion
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="bg-gray-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-xs text-gray-600 mb-4">Start the discussion about this patient's treatment plan</p>
                  <Link 
                    href={`/mdt/${mdt.id}/chat`}
                    className="inline-flex items-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors text-sm"
                    style={{ backgroundColor: '#EA6C9D' }}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 113 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                    </svg>
                    Start Discussion
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
              
              <div className="space-y-3">
                
                {isLocalUser && (
                  <Link 
                    href={`/mdt/${mdt.id}/invite`}
                    className="w-full flex items-center justify-center px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                    style={{ backgroundColor: '#EA6C9D' }}
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Send Invitations
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 