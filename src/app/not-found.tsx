import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
        <p className="text-gray-600">
          Sorry, the page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-white px-4 py-2 rounded-md hover:opacity-90 transition-colors"
        style={{ backgroundColor: '#EA6C9D' }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
} 