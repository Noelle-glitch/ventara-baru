"use client";

import { useTraining } from "@/app/context/TrainingContext";

export function useTrainToast() {
  const { training, startTraining } = useTraining();

  const startTrainToast = (onComplete?: () => void) => {
    startTraining(onComplete);
  };

  return {
    visible: training.isTraining,
    step: training.step,
    progress: training.progress,
    logs: training.logs,
    footer: training.footer,
    startTrainToast,
  };
}