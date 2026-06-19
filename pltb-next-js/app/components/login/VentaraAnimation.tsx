'use client';

import Lottie, { LottieRefCurrentProps } from 'lottie-react';

import { useEffect, useRef } from 'react';

import idleAnimation from '@/public/lottie/Login.json';
import errorAnimation from '@/public/lottie/Denied.json';

interface Props {
  isError: boolean;
}

export default function VentaraAnimation({
  isError,
}: Props) {

  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {

    if (lottieRef.current) {

      lottieRef.current.setSpeed(
        isError ? 0.5 : 1
      );

    }

  }, [isError]);

  return (
    <div className="w-145 h-145">
      <Lottie
        lottieRef={lottieRef}
        animationData={
          isError
            ? errorAnimation
            : idleAnimation
        }
        loop
        autoplay
      />
    </div>
  );
}