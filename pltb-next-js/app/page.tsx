'use client';

import LoginForm from "@/app/components/login/LoginForm";
import RegisterForm from "@/app/components/login/RegisterForm";
import LandingPanel from "@/app/components/login/LandingPanel";
import OverlayPanel from "@/app/components/login/OverlayPanel";
import { useAuth } from "@/app/hooks/useAuth";

export default function LoginPage() {
  const {
    view,
    setView,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    isError,
  } = useAuth();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dff7f3,#ccebe6,#eafaf7)]">
      {/* AMBIENT LIGHT */}
      <div className="absolute w-125 h-125 bg-[#00a991]/20 blur-[120px] rounded-full -top-30 -left-25" />
      <div className="absolute w-100 h-100 bg-[#008774]/10 blur-[120px] rounded-full -bottom-30 -right-25" />

      {/* MAIN CONTAINER */}
      <div className="relative w-full h-full overflow-hidden bg-teal-300">

        {/* OVERLAY PANEL */}
        <div className={`absolute top-0 w-1/2 h-full z-20 transition-all duration-700 ease-in-out ${view === 'login' ? 'left-1/2' : 'left-0'}`}>
          <div className="relative w-full h-full shadow-[0_20px_45px_rgba(0,169,145,0.35)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_60%)] before:pointer-events-none">
            <OverlayPanel isError={isError} isLogin={view === 'login'} />
          </div>
        </div>

        {/* RIGHT CONTENT */}
        <div className={`absolute top-0 w-1/2 h-full right-0 flex items-start justify-center pt-24 transition-all duration-700 ${view === 'login' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {/* LANDING */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${view === 'landing' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'}`}>
            <LandingPanel onStart={() => setView('login')} />
          </div>

          {/* REGISTER */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${view === 'register' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'}`}>
            <RegisterForm onRegister={handleRegister} onSwitch={() => setView('login')} />
          </div>
        </div>

        {/* LOGIN */}
        <div className={`absolute top-0 left-0 w-1/2 h-full flex items-center justify-center transition-all duration-700 ${view === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <LoginForm onLogin={handleLogin} onSwitch={() => setView('register')} onForgotPassword={handleForgotPassword} />
        </div>
      </div>
    </div>
  );
}