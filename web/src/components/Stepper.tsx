"use client";

import React from "react";

interface StepperProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  language?: "EN" | "PT";
}

const steps = {
  EN: ["Credentials", "Family Members", "Preferences", "Ranking Bot", "Deploy & Finish"],
  PT: ["Credenciais", "Membros da família", "Preferências", "Bot de ranking", "Implantar e concluir"],
};

export function Stepper({ currentStep, onSelectStep, language = "EN" }: StepperProps) {
  const labels = steps[language];
  return (
    <nav className="stepper" aria-label="Setup steps">
      {labels.map((name, index) => {
        const s = { step: index + 1, name };
        const isActive = currentStep === s.step;
        const isCompleted = currentStep > s.step;
        return (
          <React.Fragment key={s.step}>
            <div
              className={`step-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
              onClick={() => onSelectStep(s.step)}
            >
              <div className="step-circle">{isCompleted ? "✓" : s.step}</div>
              <span className="step-name">{s.name}</span>
            </div>
            {index < labels.length - 1 && (
              <div className={`step-line ${currentStep > s.step ? "filled" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
