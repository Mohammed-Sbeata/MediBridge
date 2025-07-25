import Logo from '../components/Logo';

// Force this layout to be dynamic
export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 pt-12">
        <Logo />
        {children}
      </div>
    </div>
  );
} 