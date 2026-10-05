'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function SignOutButton({ loginPath, label }: { loginPath: string; label: string }) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        // A full navigation, so the server render sees the cleared cookie.
        router.replace(loginPath);
        router.refresh();
      }}
    >
      <LogOut />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
