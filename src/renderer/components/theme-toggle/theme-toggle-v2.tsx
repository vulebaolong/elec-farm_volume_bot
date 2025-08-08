'use client';

import { useToggleTheme } from '@/hooks/use-toggle-theme';
import { Moon, SunDim } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';

export default function ThemeToggleV2({ className }: { className?: string }) {
  const { theme, setTheme } = useToggleTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`flex gap-1 rounded-lg border border-border-subtlest-tertiary p-0.5 ${className}`}
    >
      <Button
        type="button"
        className="size-6"
        onClick={() => setTheme('dark')}
        variant="ghost"
      >
        <Moon
          fill={
            theme === 'dark' ? 'var(--primary)' : 'var(--primary-foreground)'
          }
        />
      </Button>
      <Button
        type="button"
        className="size-6"
        onClick={() => setTheme('light')}
        variant="ghost"
      >
        <SunDim
          size={30}
          fill={
            theme === 'light' ? 'var(--primary)' : 'var(--primary-foreground)'
          }
        />
      </Button>
    </div>
  );
}
