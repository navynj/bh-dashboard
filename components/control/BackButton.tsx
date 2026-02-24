'use client';

import { ArrowLeftIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';

const BackButton = () => {
  const router = useRouter();

  const handleClick = () => {
    router.back();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="opacity-50 hover:opacity-70"
      onClick={handleClick}
    >
      <ArrowLeftIcon className="size-4" />
      Back
    </Button>
  );
};

export default BackButton;
