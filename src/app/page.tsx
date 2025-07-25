'use client';

import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [isGetStartedClicked, setIsGetStartedClicked] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <main className="max-w-2xl w-full text-center space-y-8">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/medibridge-logo.png"
            alt="MediBridge Logo"
            width={200}
            height={80}
            className="mx-auto"
            priority
          />
        </div>

        {/* Welcome Text */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-800">
            Welcome to MediBridge
          </h1>
          <p className="text-xl text-gray-600">
            Connecting Healthcare Professionals Across Borders
          </p>
        </div>

        {/* Buttons */}
        <div className="space-y-4 mt-8">
          {!isGetStartedClicked ? (
            <div className="space-y-4">
              <button
                onClick={() => setIsGetStartedClicked(true)}
                className="text-white px-8 py-3 rounded-full 
                       text-lg font-semibold transition-all duration-200 shadow-lg hover:opacity-90"
                style={{ backgroundColor: '#EA6C9D' }}
              >
                Get Started
              </button>
              <div>
                <a
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 font-medium text-lg transition-colors duration-200"
                >
                  Already have an account? Sign in
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => window.location.href = '/local_signup'}
                                                    className="w-full text-white px-6 py-3 hover:opacity-90 
                           rounded-lg text-lg font-semibold transition-colors duration-200"
                  style={{ backgroundColor: '#EA6C9D' }}
              >
                Join as Gaza Healthcare Professional
              </button>
              <button
                onClick={() => window.location.href = '/external_signup'}
                                                    className="w-full text-white px-6 py-3 hover:opacity-90 
                           rounded-lg text-lg font-semibold transition-colors duration-200"
                  style={{ backgroundColor: '#EA6C9D' }}
                >
                  Join as External Healthcare Professional
              </button>
              <div className="pt-2">
                <a
                  href="/login"
                  className="text-gray-600 hover:text-blue-600 text-sm transition-colors duration-200"
                >
                  Already have an account? Sign in
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
