"use client";

import Image from "next/image";

import VentaraAnimation from "./VentaraAnimation";

interface Props {
  isError: boolean;
  isLogin: boolean; 
}

export default function OverlayPanel({ isError, isLogin }: Props) {
  return (
    <div
      className="
        relative
        w-full
        h-full

        overflow-hidden

        bg-linear-to-br
        from-[#f8fffd]
        via-[#f2fffb]
        to-[#eefaf7]

        flex
        flex-col
        justify-center
        items-center

        px-12
      "
    >

      {/* CENTER BLUR */}
      <div
        className="
          absolute
          top-1/2
          left-1/2
          -translate-x-1/2
          -translate-y-1/2

          w-105
          h-105

          rounded-full

          bg-linear-to-br
          from-cyan-200/40
          via-teal-200/30
          to-emerald-200/20

          blur-[100px]
        "
      />

      {/* LOGO - TOP LEFT CORNER */}
      <div className={`absolute top-13 z-20 transition-all duration-700 ease-in-out ${
        isLogin ? "right-12" : "left-12"
      }`}>
        <Image
          src="/icon/logo-ventara.svg"
          alt="Ventara"
          width={260}
          height={260}
          className="
            object-contain
            drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]
          "
        />
      </div>

      {/* GRID EFFECT - Pindahkan ke bawah SVG */}
      <div
        className="
          absolute
          inset-0
          opacity-[0.04]

          bg-[linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)]
          bg-size-[42px_42px]

          z-0
        "
      />

      {/* CONTENT - CENTERED ANIMATION dengan z-index lebih tinggi */}
      <div
        className="
          relative
          z-20

          flex
          flex-col
          items-center
          justify-center

          w-full
        "
      >
        {/* LARGER ANIMATION */}
        <div
          className="
            w-full
            max-w-151.5
            mt-14

            drop-shadow-[0_20px_40px_rgba(0,0,0,0.12)]
          "
        >
          <VentaraAnimation isError={isError} />
        </div>
      </div>
    </div>
  );
}
