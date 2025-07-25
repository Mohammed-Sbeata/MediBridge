'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Logo() {
  return (
    <div className="flex justify-center mb-6">
      <Link href="/dashboard" className="hover:opacity-80 transition-opacity">
        <Image
          src="/logo.png"
          alt="MediBridge Logo"
          width={80}
          height={32}
          className="h-auto"
          priority
        />
      </Link>
    </div>
  );
} 