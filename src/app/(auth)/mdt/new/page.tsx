'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { uploadAudioFile, uploadImageFile } from '../../../lib/supabase';

interface Specialty {
  id: number;
  name: string;
}


interface LocalDoctor {
  id: string;
  name: string;
  email: string;
  specialties: Array<{ id: number; name: string }>;
}

interface Medication {
  name: string;
  dosage: string;
}

const createMDTSchema = z.object({
  name: z.string().min(1, 'MDT name is required'),
  patientProfile: z.object({
    age: z.number().min(1, 'Patient age is required').max(150, 'Please enter a valid age'),
    gender: z.enum(['MALE', 'FEMALE']),
    uniqueId: z.string().min(1, 'Patient ID is required'),
    medicalHistory: z.string().min(1, 'Medical history is required'),
    caseSummary: z.string().min(1, 'Case summary is required'),
    medications: z.array(z.object({
      name: z.string().min(1, 'Medication name is required'),
      dosage: z.string().min(1, 'Dosage is required'),
    })),
  }),
  localDoctors: z.array(z.string()).min(1, 'At least one local doctor is required'),
  requiredSpecialties: z.array(z.number()).min(1, 'At least one specialty is required'),
});

type CreateMDTForm = z.infer<typeof createMDTSchema>;

export default function CreateMDT() {
  const { data: session, status } = useSession({
    required: true,
  });

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [localDoctors, setLocalDoctors] = useState<LocalDoctor[]>([]);
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '' }]);
  const [emailSearch, setEmailSearch] = useState('');
  const [searchResults, setSearchResults] = useState<LocalDoctor[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<LocalDoctor[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    trigger,
    getValues,
    control,
  } = useForm<CreateMDTForm>({
    resolver: zodResolver(createMDTSchema),
    defaultValues: {
      name: '',
      patientProfile: {
        age: 0,
        gender: 'MALE' as const,
        uniqueId: '',
        medicalHistory: '',
        caseSummary: '',
        medications: [{ name: '', dosage: '' }],
      },
      localDoctors: [],
      requiredSpecialties: [],
    },
  });

  useEffect(() => {
    // Fetch specialties
    const fetchSpecialties = async () => {
      try {
        const response = await fetch('/api/specialties');
        if (!response.ok) throw new Error('Failed to fetch specialties');
        const data = await response.json();
        setSpecialties(data);
      } catch (err) {
        console.error('Error fetching specialties:', err);
      }
    };

    // Fetch local doctors
    const fetchLocalDoctors = async () => {
      try {
        const response = await fetch('/api/users/local');
        if (!response.ok) throw new Error('Failed to fetch local doctors');
        const data = await response.json();
        setLocalDoctors(data);
      } catch (err) {
        console.error('Error fetching local doctors:', err);
      }
    };

    fetchSpecialties();
    fetchLocalDoctors();
  }, []);

  // Filter doctors based on email search
  useEffect(() => {
    if (emailSearch.length >= 2) {
      const filtered = localDoctors.filter(doctor => 
        doctor.email.toLowerCase().includes(emailSearch.toLowerCase()) &&
        !selectedDoctors.some(selected => selected.id === doctor.id)
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [emailSearch, localDoctors, selectedDoctors]);

  const addDoctor = (doctor: LocalDoctor) => {
    setSelectedDoctors(prev => [...prev, doctor]);
    setEmailSearch('');
    setSearchResults([]);
    setValue('localDoctors', [...selectedDoctors.map(d => d.id), doctor.id]);
  };

  const removeDoctor = (doctorId: string) => {
    setSelectedDoctors(prev => prev.filter(d => d.id !== doctorId));
    setValue('localDoctors', selectedDoctors.filter(d => d.id !== doctorId).map(d => d.id));
  };

  const addMedication = () => {
    const newMedication = { name: '', dosage: '' };
    setMedications(prev => [...prev, newMedication]);
    const currentMedications = getValues('patientProfile.medications') || [];
    setValue('patientProfile.medications', [...currentMedications, newMedication]);
  };

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
    const currentMedications = getValues('patientProfile.medications') || [];
    setValue(
      'patientProfile.medications',
      currentMedications.filter((_, i) => i !== index)
    );
  };

  // Update form when specialties change
  useEffect(() => {
    setValue('requiredSpecialties', selectedSpecialties);
    trigger('requiredSpecialties');
  }, [selectedSpecialties, setValue, trigger]);

  const handleSpecialtyChange = (specialtyId: number, checked: boolean) => {
    setSelectedSpecialties(prev => {
      if (checked) {
        return [...prev, specialtyId];
      } else {
        return prev.filter(id => id !== specialtyId);
      }
    });
  };

  const onSubmit = async (data: CreateMDTForm) => {
    try {
      setLoading(true);
      setError(null);
      setHasSubmitted(true);

      // Create the MDT with patient profile
      const mdtResponse = await fetch('/api/mdts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          patientProfile: data.patientProfile,
          localDoctors: data.localDoctors,
          requiredSpecialties: data.requiredSpecialties,
        }),
      });

      if (!mdtResponse.ok) {
        const errorData = await mdtResponse.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.error || 'Failed to create MDT');
      }

      const mdt = await mdtResponse.json();
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create MDT');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const onError = (errors: any) => {
    setHasSubmitted(true);
    console.error('Form Validation Errors:', errors);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update form values when doctors are selected/removed
  useEffect(() => {
    setValue('localDoctors', selectedDoctors.map(d => d.id));
  }, [selectedDoctors, setValue]);

  // Cleanup recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
    }
  };

  const handleAudioUpload = async () => {
    if (!audioBlob || !session?.user?.id) return;

    setUploadingAudio(true);
    try {
      // Upload to Supabase storage first
      const uploadResult = await uploadAudioFile(audioBlob, session.user.id);
      
      if (uploadResult.error) {
        throw new Error(`Supabase upload failed: ${uploadResult.error}`);
      }

      // Check if CodeWords API key is available
      const apiKey = process.env.NEXT_PUBLIC_CODEWORDS_API_KEY;
      if (!apiKey) {
        throw new Error('CodeWords API key is not configured. Please contact an administrator.');
      }

      // Now make API call with the Supabase URL
      const response = await fetch('https://runtime.codewords.ai/run/mp3_to_mdt_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          audio_file: uploadResult.url,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Populate form fields with extracted data
        if (result.age && result.age > 0) {
          setValue('patientProfile.age', result.age);
        }
        if (result.gender) {
          const normalizedGender = result.gender.toString().toUpperCase();
          if (['MALE', 'FEMALE'].includes(normalizedGender)) {
            setValue('patientProfile.gender', normalizedGender as 'MALE' | 'FEMALE');
          }
        }
        if (result.medical_history) {
          setValue('patientProfile.medicalHistory', result.medical_history);
        }
        if (result.case_summary) {
          setValue('patientProfile.caseSummary', result.case_summary);
        }
        if (result.medications && Array.isArray(result.medications) && result.medications.length > 0) {
          const formattedMedications = result.medications.map((med: any) => ({
            name: med.name || med.medication || '',
            dosage: med.dosage || med.dose || ''
          }));
          setValue('patientProfile.medications', formattedMedications);
          setMedications(formattedMedications);
        }
        
        // Trigger validation to update form state
        trigger(['patientProfile.age', 'patientProfile.gender', 'patientProfile.medicalHistory', 'patientProfile.caseSummary', 'patientProfile.medications']);
        
        // Show success message
        setExtractionSuccess('Patient data extracted from audio and populated into form!');
        setTimeout(() => setExtractionSuccess(null), 5000);
        
        setAudioBlob(null);
        setRecordingTime(0);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }
    } catch (err) {
      console.error('Error uploading audio:', err);
      alert(`Failed to upload audio recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  // Image upload functions
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async () => {
    if (!selectedImage || !session?.user?.id) return;

    setUploadingImage(true);
    try {
      
      // Upload to Supabase storage first
      const uploadResult = await uploadImageFile(selectedImage, session.user.id);
      
      if (uploadResult.error) {
        throw new Error(`Supabase upload failed: ${uploadResult.error}`);
      }

      // Check if CodeWords API key is available
      const apiKey = process.env.NEXT_PUBLIC_CODEWORDS_API_KEY;
      if (!apiKey) {
        throw new Error('CodeWords API key is not configured. Please contact an administrator.');
      }

      // Now make API call to OCR extractor with the Supabase URL
      const response = await fetch('https://runtime.codewords.ai/run/image_ocr_workflow_v2/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          image_url: uploadResult.url,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Populate form fields with extracted data
        if (result.age && result.age > 0) {
          setValue('patientProfile.age', result.age);
        }
        if (result.gender) {
          const normalizedGender = result.gender.toString().toUpperCase();
          if (['MALE', 'FEMALE'].includes(normalizedGender)) {
            setValue('patientProfile.gender', normalizedGender as 'MALE' | 'FEMALE');
          }
        }
        if (result.medical_history) {
          setValue('patientProfile.medicalHistory', result.medical_history);
        }
        if (result.case_summary) {
          setValue('patientProfile.caseSummary', result.case_summary);
        }
        if (result.medications && Array.isArray(result.medications) && result.medications.length > 0) {
          const formattedMedications = result.medications.map((med: any) => ({
            name: med.name || med.medication || '',
            dosage: med.dosage || med.dose || ''
          }));
          setValue('patientProfile.medications', formattedMedications);
          setMedications(formattedMedications);
        }
        
        // Trigger validation to update form state
        trigger(['patientProfile.age', 'patientProfile.gender', 'patientProfile.medicalHistory', 'patientProfile.caseSummary', 'patientProfile.medications']);
        
        // Show success message
        setExtractionSuccess('Patient data extracted from image and populated into form!');
        setTimeout(() => setExtractionSuccess(null), 5000);
        
        setSelectedImage(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process image');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(`Failed to upload image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900">Create New MDT</h1>
            <p className="mt-2 text-gray-600">Fill in the details below to create a new Multi-Disciplinary Team.</p>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              {/* Audio Recording Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isRecording 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a2 2 0 114 0v4a2 2 0 11-4 0V7z" clipRule="evenodd" />
                      </svg>
                      Stop ({formatTime(recordingTime)})
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 4a3 3 0 616 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                      Record Audio
                    </>
                  )}
                </button>
                
                                  {/* Audio upload notification */}
                  {audioBlob && !isRecording && (
                    <div className="absolute top-full mt-2 left-0 right-0 bg-green-50 border border-green-200 rounded-lg p-3 z-10">
                      <p className="text-sm text-green-700 mb-2">Recording ready ({formatTime(recordingTime)})</p>
                      <button
                        onClick={handleAudioUpload}
                        disabled={uploadingAudio}
                        className={`w-full px-3 py-1 text-sm rounded transition-colors ${
                          uploadingAudio
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {uploadingAudio ? 'Uploading to Storage...' : 'Upload Audio'}
                      </button>
                    </div>
                  )}
              </div>

              {/* Image Upload Button */}
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                  Upload Image
                </button>

                {/* Image preview and upload */}
                {selectedImage && imagePreview && (
                  <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg p-4 z-10 w-64 shadow-lg">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                    <p className="text-sm text-gray-700 mb-2">
                      {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleImageUpload}
                        disabled={uploadingImage}
                        className={`flex-1 px-3 py-1 text-sm rounded transition-colors ${
                          uploadingImage 
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {uploadingImage ? 'Uploading...' : 'Upload'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="flex-1 px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Show all form errors at the top - only show if form has been submitted */}
          {Object.keys(errors).length > 0 && hasSubmitted && (
            <div className="mx-8 mt-6 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-100">
              <div className="font-medium">Please fix the following errors:</div>
              <ul className="mt-2 list-disc list-inside text-sm">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>
                    {error?.message?.toString() || `${field} is required`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="mx-8 mt-6 bg-red-50 text-red-700 px-4 py-3 rounded-lg border border-red-100">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">{error}</p>
              </div>
          </div>
        )}

          {extractionSuccess && (
            <div className="mx-8 mt-6 bg-green-50 text-green-700 px-4 py-3 rounded-lg border border-green-100">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">{extractionSuccess}</p>
              </div>
            </div>
          )}

          <form 
            onSubmit={handleSubmit(onSubmit, onError)} 
            className="p-8 space-y-8"
          >
            {/* MDT Information */}
            <div className="bg-white rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">MDT Information</h2>
              <div className="space-y-4">
          <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
              MDT Name
            </label>
            <input
              {...register('name')}
              type="text"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
              placeholder="e.g., Complex Case Review - Oncology"
            />
            {errors.name && (
                    <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Patient Information */}
            <div className="bg-white rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Patient Information</h2>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="patientProfile.age" className="block text-sm font-medium text-gray-900 mb-2">
                      Patient Age
                    </label>
                    <input
                      {...register('patientProfile.age', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="150"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.patientProfile?.age && (
                      <p className="mt-2 text-sm text-red-600">{errors.patientProfile.age.message}</p>
            )}
          </div>

          <div>
                    <label htmlFor="patientProfile.uniqueId" className="block text-sm font-medium text-gray-900 mb-2">
                      Patient ID
            </label>
            <input
                      {...register('patientProfile.uniqueId')}
              type="text"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.patientProfile?.uniqueId && (
                      <p className="mt-2 text-sm text-red-600">{errors.patientProfile.uniqueId.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="patientProfile.gender" className="block text-sm font-medium text-gray-900 mb-2">
                    Gender
                  </label>
                  <select
                    {...register('patientProfile.gender')}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                  {errors.patientProfile?.gender && (
                    <p className="mt-2 text-sm text-red-600">{errors.patientProfile.gender.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="patientProfile.medicalHistory" className="block text-sm font-medium text-gray-900 mb-2">
                    Medical History
                  </label>
                  <textarea
                    {...register('patientProfile.medicalHistory')}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.patientProfile?.medicalHistory && (
                    <p className="mt-2 text-sm text-red-600">{errors.patientProfile.medicalHistory.message}</p>
            )}
          </div>

          <div>
                  <label htmlFor="patientProfile.caseSummary" className="block text-sm font-medium text-gray-900 mb-2">
                    Case Summary
            </label>
            <textarea
                    {...register('patientProfile.caseSummary')}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.patientProfile?.caseSummary && (
                    <p className="mt-2 text-sm text-red-600">{errors.patientProfile.caseSummary.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Medications */}
            <div className="bg-white rounded-lg">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Medications</h2>
                <button
                  type="button"
                  onClick={addMedication}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <svg className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add Medication
                </button>
              </div>
              <div className="space-y-4">
                {medications.map((_, index) => (
                  <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Medication Name
                      </label>
                      <input
                        {...register(`patientProfile.medications.${index}.name`)}
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Dosage
                      </label>
                      <input
                        {...register(`patientProfile.medications.${index}.dosage`)}
                        type="text"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeMedication(index)}
                        className="mt-8 text-red-600 hover:text-red-700"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Team Members</h2>
              
              {/* Local Doctors */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-900 mb-4">
                  Local Team Members
                </label>
                <div className="space-y-4">
                  {/* Email Search Input */}
                  <div className="relative">
                    <input
                      type="email"
                      value={emailSearch}
                      onChange={(e) => setEmailSearch(e.target.value)}
                      placeholder="Search by email..."
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    
                    {/* Search Results Dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                        {searchResults.map((doctor) => (
                          <button
                            key={doctor.id}
                            type="button"
                            onClick={() => addDoctor(doctor)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900">{doctor.name}</div>
                                <div className="text-sm text-gray-500">{doctor.email}</div>
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {doctor.specialties.map(s => s.name).join(', ')}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Doctors */}
                  <div className="space-y-3">
                    {selectedDoctors.map((doctor) => (
                      <div
                        key={doctor.id}
                        className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{doctor.name}</div>
                          <div className="text-sm text-gray-500">{doctor.email}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {doctor.specialties.map(s => s.name).join(', ')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoctor(doctor.id)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  {errors.localDoctors && (
                    <p className="mt-2 text-sm text-red-600">{errors.localDoctors.message}</p>
                  )}
                </div>
              </div>

              {/* Required Specialties */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-4">
                  Required External Specialties
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {specialties.map((specialty) => (
                    <label key={specialty.id} className="relative flex items-start p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <div className="min-w-0 flex-1 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedSpecialties.includes(specialty.id)}
                          onChange={(e) => handleSpecialtyChange(specialty.id, e.target.checked)}
                          className="hidden peer"
                        />
                        <div className="font-medium text-gray-900 peer-checked:text-blue-600">
                          {specialty.name}
                        </div>
                      </div>
                      <div className="ml-3 flex h-5 items-center">
                        <svg className="hidden peer-checked:block h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.requiredSpecialties && hasSubmitted && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.requiredSpecialties.message}
                  </p>
                )}
              </div>
          </div>

            <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
                className="flex-1 px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
                disabled={loading || isSubmitting}
                className={`flex-1 px-6 py-3 text-white font-medium rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                  (loading || isSubmitting) ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: '#EA6C9D' }}
              >
                {(loading || isSubmitting) ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create MDT'
                )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 